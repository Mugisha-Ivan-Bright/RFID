#!/usr/bin/env python3
"""
Quick MQTT Test - Simulates a card scan for ivan_bright
Run this to test if your backend receives and processes the message correctly.
"""
import paho.mqtt.client as mqtt
import json
import time

BROKER = "broker.benax.rw"
PORT = 1883
TEAM_ID = "ivan_bright"

def test_card_scan():
    print("=== MQTT Card Scan Simulator ===")
    print(f"Connecting to {BROKER}...")
    
    try:
        from paho.mqtt.enums import CallbackAPIVersion
        client = mqtt.Client(CallbackAPIVersion.VERSION1, client_id=f"Test_Client_{int(time.time())}")
    except ImportError:
        client = mqtt.Client(client_id=f"Test_Client_{int(time.time())}")
    
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    
    time.sleep(1)
    
    # Simulate a card scan
    topic = f"rfid/{TEAM_ID}/card/status"
    payload = {
        "uid": "TEST123ABC",
        "balance": 5000,
        "status": "detected",
        "ts": int(time.time())
    }
    
    print(f"\n📤 Publishing test card scan to: {topic}")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    
    client.publish(topic, json.dumps(payload))
    
    print("\n✅ Test message sent!")
    print("Check your backend terminal for:")
    print("  📥 [MQTT IN] rfid/ivan_bright/card/status")
    print("  📢 [BROADCAST] Revealing card: TEST123ABC")
    print("\nCheck your dashboard - it should unlock and show the test card!")
    
    time.sleep(2)
    client.loop_stop()
    client.disconnect()

if __name__ == "__main__":
    test_card_scan()
