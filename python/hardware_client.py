import serial
import requests
import json
import time

# --- CONFIGURATION ---
BASE_URL = "http://localhost:8080"
# Try to auto-detect or set your COM port here
SERIAL_PORT = "COM3" 
BAUD_RATE = 115200 # Standard for ESP8266/Arduino

def send_to_server(uid):
    uid = uid.strip()
    if not uid:
        return
    
    print(f"[*] Detected UID: {uid}")
    url = f"{BASE_URL}/scan"
    try:
        response = requests.post(url, json={"uid": uid})
        if response.status_code == 200:
            print(f"[+] Server synced: {response.json().get('message')}")
        else:
            print(f"[-] Server error: {response.status_code}")
    except Exception as e:
        print(f"[-] Connection failed: {e}")

def main():
    print("=== Dilocash Hardware Link ===")
    print(f"Opening {SERIAL_PORT} at {BAUD_RATE} baud...")
    
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        time.sleep(2) # Wait for hardware reset
        print(f"[!] Connected to {SERIAL_PORT}. Waiting for RFID scans...")
        
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                if line:
                    # Logic to handle pure UID strings
                    # Your hardware should just print the UID to Serial
                    send_to_server(line)
            time.sleep(0.01)
            
    except serial.SerialException as e:
        print(f"[-] Serial Error: {e}")
        print("[TIP] Is your hardware plugged into COM3? Is another app using it?")
    except KeyboardInterrupt:
        print("\n[*] Closing connection...")
    finally:
        if 'ser' in locals():
            ser.close()

if __name__ == "__main__":
    main()
