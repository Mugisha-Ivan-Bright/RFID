import requests
import time
import json

BASE_URL = "http://localhost:8080"

def simulate_scan(uid):
    print(f"[*] Simulating scan for UID: {uid}")
    url = f"{BASE_URL}/scan"
    print(f"[DEBUG] POST {url}")
    try:
        response = requests.post(url, json={"uid": uid})
        if response.status_code == 200:
            print(f"[+] Success: {response.json().get('message')}")
            print(f"    Card Info: {response.json().get('card')}")
        else:
            print(f"[-] Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[-] Connection Error: {e}")

def main():
    print("=== RFID Simulation Client ===")
    print(f"Connecting to: {BASE_URL}")
    print("Type a UID and press Enter to simulate a scan.")
    print("Type 'exit' to quit.")
    
    while True:
        try:
            uid = input("\nRFID UID > ").strip()
            if not uid:
                continue
            if uid.lower() == 'exit':
                break
            
            simulate_scan(uid)
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
