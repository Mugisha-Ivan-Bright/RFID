import serial
import paho.mqtt.client as mqtt
import json
import time
import sys
import socket
import threading
import re

# --- CONFIGURATION FROM USER SNIPPET ---
TEAM_ID = "ivan_bright"
BROKER = "broker.benax.rw"
PORT = 1883
SERIAL_PORT = "COM3"
BAUD_RATE = 115200

# WiFi Metadata (from your snippet)
WIFI_SSID = "EdNet"
WIFI_PASS = "Huawei@123"

# TOPICS
TOPIC_STATUS  = f"rfid/{TEAM_ID}/card/status"
TOPIC_BALANCE = f"rfid/{TEAM_ID}/card/balance"
TOPIC_TOPUP   = f"rfid/{TEAM_ID}/card/topup"
TOPIC_HEALTH  = f"rfid/{TEAM_ID}/device/health"
TOPIC_LWT     = f"rfid/{TEAM_ID}/device/status"

HEALTH_INTERVAL = 60 # seconds
last_health_report = 0

def get_unix_time():
    return int(time.time())

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✓ Connected to MQTT Broker: {BROKER}")
        # Subscribe to EVERYTHING in the rfid/ namespace for debugging
        client.subscribe(f"rfid/{TEAM_ID}/#")
        print(f"✓ Sniffer Active: Subscribed to 'rfid/#'")
    else:
        print(f"✗ Connection failed, rc={rc}")

# Local Persistence for Bridge (Simulated Cards/Balances)
simulated_cards = {}
current_card_present = False
last_card_uid = None

def publish_health(client):
    health = {
        "status": "online",
        "ssid": WIFI_SSID,
        "ip": get_local_ip(),
        "rssi": -50,
        "free_heap": 40000,
        "ts": get_unix_time()
    }
    client.publish(TOPIC_HEALTH, json.dumps(health))
    print("Health report published")

def publish_card_removed(client, uid):
    """Publish card removal status"""
    print(f"\n🔴 CARD REMOVED: {uid}")
    removal_payload = {
        "uid": uid,
        "status": "removed",
        "ts": get_unix_time()
    }
    client.publish(TOPIC_STATUS, json.dumps(removal_payload))

def process_scan(client, uid):
    global current_card_present, last_card_uid
    
    uid = uid.strip().upper()
    
    # Fetch balance from backend database (cloud server)
    try:
        import requests
        # Try cloud server first, then local
        backend_urls = [
            f"http://157.173.101.159:9249/card/{uid}",  # Cloud server
            f"http://localhost:8080/card/{uid}"          # Local server
        ]
        
        balance = 50.0  # Default
        for url in backend_urls:
            try:
                response = requests.get(url, timeout=2)
                if response.ok:
                    card_data = response.json()
                    balance = card_data.get('balance', 50.0)
                    print(f"\n✨ CARD SCANNED: {uid} | Balance from DB: {balance} RWF")
                    break
            except:
                continue
        else:
            # No backend reachable, use cached or default
            balance = simulated_cards.get(uid, 50.0)
            print(f"\n✨ CARD SCANNED: {uid} | Using cached balance: {balance} RWF")
            
    except Exception as e:
        # Fallback if backend is unreachable
        print(f"⚠️ Backend unreachable: {e}")
        balance = simulated_cards.get(uid, 50.0)
    
    # Cache it locally for this session
    simulated_cards[uid] = balance
    
    print(f"[*] Broadcasting via MQTT...")
    
    status_payload = {
        "uid": uid,
        "balance": balance,
        "status": "detected",
        "ts": get_unix_time()
    }
    client.publish(TOPIC_STATUS, json.dumps(status_payload))
    
    current_card_present = True
    last_card_uid = uid

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload_str = msg.payload.decode()
        print(f"\n[MQTT SNIFFER] Incoming: {topic} | Data: {payload_str}")
        
        # Try to parse as JSON, skip if it's just a status string
        try:
            payload = json.loads(payload_str)
        except json.JSONDecodeError:
            # It's a plain text message (like "online" or "offline"), ignore it
            return
            
        uid = payload.get("uid")
        
        # If it's a Top-Up request from Backend
        if topic.endswith("/card/topup"):
            amount = payload.get("amount", 0)
            new_bal = payload.get("new_balance") # Backend sends the goal
            
            if uid:
                # Update local cache
                simulated_cards[uid] = new_bal if new_bal is not None else (simulated_cards.get(uid,0)+amount)
                
                print(f"💰 TOP-UP PROCESSED: {uid} | New Balance: {simulated_cards[uid]}")
                
                # Respond with confirmation
                response = {
                    "uid": uid,
                    "new_balance": simulated_cards[uid],
                    "amount": amount,
                    "status": "success",
                    "ts": get_unix_time()
                }
                client.publish(TOPIC_BALANCE, json.dumps(response))
                
    except Exception as e:
        print(f"❌ [BRIDGE ERROR] {e}")

def manual_input_loop(client):
    print("\n[HINT] Type a UID (e.g. A1B2C3D4) or 'unlock' to test.")
    while True:
        try:
            val = sys.stdin.readline().strip()
            if not val: continue
            
            if val.lower() == "unlock":
                print("[*] Sending Force-Unlock (UID: TEST_UNLOCK)")
                process_scan(client, "TEST_UNLOCK")
            elif re.match(r'^[0-9A-Fa-f]{4,16}$', val):
                process_scan(client, val)
            else:
                print(f"[!] '{val}' is not a valid UID or command.")
        except:
            break

def main():
    print("=== Dilocash Python Hardware Node ===")
    
    # Setup MQTT (paho-mqtt 2.x compatibility)
    try:
        from paho.mqtt.enums import CallbackAPIVersion
        client = mqtt.Client(CallbackAPIVersion.VERSION1, client_id=f"Python_Node_{get_unix_time()}")
    except ImportError:
        client = mqtt.Client(client_id=f"Python_Node_{get_unix_time()}")
    
    client.on_connect = on_connect
    client.on_message = on_message
    
    # Set Last Will and Testament
    client.will_set(TOPIC_LWT, "offline", retain=True)

    try:
        client.connect(BROKER, PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"✗ Could not connect to MQTT: {e}")
        return

    # Setup Serial
    try:
        # Start manual input thread
        input_thread = threading.Thread(target=manual_input_loop, args=(client,), daemon=True)
        input_thread.start()

        print(f"[*] Opening {SERIAL_PORT} @ {BAUD_RATE}...")
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        time.sleep(2)
        print("✓ System initialized successfully")
        print("\n[SENSOR] Sensor is READY. Please tap your RFID card.")
        
        global last_health_report, current_card_present, last_card_uid
        last_scan_time = 0
        CARD_TIMEOUT = 2.0  # If no scan for 2 seconds, consider card removed
        
        while True:
            # 1. Periodic Health Report
            if time.time() - last_health_report > HEALTH_INTERVAL:
                publish_health(client)
                last_health_report = time.time()

            # 2. Check for card removal (timeout-based)
            if current_card_present and last_card_uid:
                if time.time() - last_scan_time > CARD_TIMEOUT:
                    publish_card_removed(client, last_card_uid)
                    current_card_present = False
                    last_card_uid = None

            # 3. RFID Scanning (from Serial)
            if ser.in_waiting > 0:
                raw = ser.readline()
                if raw:
                    try:
                        line = raw.decode('utf-8', errors='ignore').strip()
                        if not line: continue

                        # Hunt for Hex UID (8-16 chars) anywhere in the line
                        # Improved regex to find UIDs precisely
                        match = re.search(r'\b([0-9A-Fa-f]{8,16})\b', line)
                        
                        if match:
                            uid = match.group(1).upper()
                            # Extra safety: filter out common system words that might look like hex (e.g. "DEAD")
                            if any(x in line.lower() for x in ["connecting", "wifi", "ip", "sync", "system", "mqtt", "health", "ready"]):
                                print(f"[HW LOG] {line}")
                                continue

                            process_scan(client, uid)
                            last_scan_time = time.time()  # Update last scan time
                            time.sleep(0.5) # Debounce
                        else:
                            if line:
                                # Log everything seen as a "LOG" so the user can show me what the hardware says when touched
                                print(f"[SCAN LOG] {line}")
                    except Exception as e:
                        # Fallback for truly binary data
                        uid = raw.hex().upper().strip()
                        if 8 <= len(uid) <= 16:
                            process_scan(client, uid)
                            last_scan_time = time.time()
                            time.sleep(0.5)
                        else:
                            # print(f"[DEBUG] Raw junk ignored: {uid[:20]}...") 
                            pass
            
            time.sleep(0.1)

    except serial.SerialException as e:
        print(f"✗ Serial Error: {e}")
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
    finally:
        client.publish(TOPIC_LWT, "offline", retain=True)
        client.loop_stop()
        if 'ser' in locals():
            ser.close()

if __name__ == "__main__":
    main()
