import network
import time
import ujson
import ntptime
from machine import Pin, SPI, reset
from umqtt.simple import MQTTClient
from mfrc522 import MFRC522
import gc

# ----------------- WiFi Configuration -----------------
SSID = "EdNet"
PASSWORD = "Huawei@123"
WIFI_TIMEOUT = 30

# ----------------- MQTT Configuration -----------------
TEAM_ID = "ivan_bright"
BROKER = "broker.benax.rw"
PORT = 1883

TOPIC_STATUS  = b"rfid/" + TEAM_ID.encode() + b"/card/status"
TOPIC_BALANCE = b"rfid/" + TEAM_ID.encode() + b"/card/balance"
TOPIC_TOPUP   = b"rfid/" + TEAM_ID.encode() + b"/card/topup"
TOPIC_HEALTH  = b"rfid/" + TEAM_ID.encode() + b"/device/health"
TOPIC_LWT     = b"rfid/" + TEAM_ID.encode() + b"/device/status"

CLIENT_ID = b"esp8266_" + TEAM_ID.encode()

mqtt = MQTTClient(CLIENT_ID, BROKER, PORT)
last_health_report = 0
HEALTH_INTERVAL = 60  # seconds

# ----------------- WiFi Setup -----------------
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID, PASSWORD)

    print("Connecting to WiFi...")
    start = time.time()

    while not wlan.isconnected():
        if time.time() - start > WIFI_TIMEOUT:
            print("WiFi timeout. Restarting...")
            reset()
        time.sleep(1)

    print("WiFi Connected:", wlan.ifconfig())

# ----------------- Time Sync -----------------
def sync_time():
    print("Syncing time...")
    try:
        ntptime.settime()
        print("Time synced")
    except:
        print("NTP failed")

def get_unix_time():
    return time.time()

# ----------------- MQTT Callback -----------------
def mqtt_callback(topic, msg):
    print("Received:", topic, msg)

    try:
        data = ujson.loads(msg)
        if "uid" not in data:
            return # Ignore messages without UID (like health reports)
            
        uid = data["uid"]
        amount = data.get("amount", 0)

        simulated_old_balance = 0
        new_balance = simulated_old_balance + amount

        response = {
            "uid": uid,
            "new_balance": new_balance,
            "status": "success",
            "ts": get_unix_time()
        }

        mqtt.publish(TOPIC_BALANCE, ujson.dumps(response))
        print("Balance updated:", new_balance)

    except Exception as e:
        print("Error handling MQTT:", e)

# ----------------- MQTT Reconnect -----------------
def connect_mqtt():
    while True:
        try:
            print("Connecting to MQTT...")
            mqtt.set_callback(mqtt_callback)
            mqtt.connect()
            mqtt.publish(TOPIC_LWT, b"online", retain=True)
            mqtt.subscribe(TOPIC_TOPUP)
            mqtt.subscribe(TOPIC_HEALTH)
            print("MQTT Connected")
            break
        except:
            print("MQTT failed. Retrying in 5s...")
            time.sleep(5)

# ----------------- Health Reporting -----------------
def publish_health():
    wlan = network.WLAN(network.STA_IF)

    health_data = {
        "status": "online",
        "ip": wlan.ifconfig()[0],
        "rssi": wlan.status("rssi"),
        "free_heap": gc.mem_free(),
        "ts": get_unix_time()
    }

    mqtt.publish(TOPIC_HEALTH, ujson.dumps(health_data))
    print("Health published")

# ----------------- RFID Setup -----------------
# SPI(1) default pins for ESP8266: sck=14, mosi=13, miso=12
rdr = MFRC522(sck=14, mosi=13, miso=12, rst=0, cs=2)

# ----------------- Main -----------------
connect_wifi()
sync_time()
connect_mqtt()

print("✓ System initialized (v2 - Fixed)")

# Track card state
card_present = False
last_uid = None

while True:
    try:
        mqtt.check_msg()

        # Health interval
        if time.time() - last_health_report > HEALTH_INTERVAL:
            publish_health()
            last_health_report = time.time()

        # RFID scanning
        (stat, tag_type) = rdr.request(rdr.REQIDL)

        if stat == rdr.OK:
            (stat, raw_uid) = rdr.anticoll()

            if stat == rdr.OK:
                uid = "".join(["%02X" % x for x in raw_uid])

                # Only publish if this is a new card detection
                if not card_present or last_uid != uid:
                    current_balance = 50.0  # simulated

                    print("Card detected:", uid, "| Balance:", current_balance)

                    payload = {
                        "uid": uid,
                        "balance": current_balance,
                        "status": "detected",
                        "ts": get_unix_time()
                    }

                    mqtt.publish(TOPIC_STATUS, ujson.dumps(payload))
                    card_present = True
                    last_uid = uid

        else:
            # Card not detected - check if it was removed
            if card_present:
                print("Card removed:", last_uid)

                payload = {
                    "uid": last_uid,
                    "status": "removed",
                    "ts": get_unix_time()
                }

                mqtt.publish(TOPIC_STATUS, ujson.dumps(payload))
                card_present = False
                last_uid = None

        time.sleep(0.1)  # Small delay for better detection

    except Exception as e:
        print("Main loop error:", e)
        time.sleep(2)
