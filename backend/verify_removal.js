const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://broker.benax.rw';
const TEAM_ID = 'ivan_bright';
const TOPIC = `rfid/${TEAM_ID}/card/status`;
const CARD_UID = "TEST_CARD_88";

const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
    console.log(`Connected to ${MQTT_BROKER}`);
    console.log(`Simulating card ${CARD_UID} on topic ${TOPIC}`);

    let count = 0;
    const max = 5;

    const interval = setInterval(() => {
        count++;
        const payload = JSON.stringify({
            uid: CARD_UID,
            balance: 500,
            status: "detected",
            ts: Date.now()
        });

        client.publish(TOPIC, payload);
        console.log(`[${count}/${max}] Sent detected status...`);

        if (count >= max) {
            clearInterval(interval);
            console.log("\nStopped sending heartbeats.");
            console.log(">>> OBSERVE FRONTEND: Card details should disappear in ~3 seconds. <<<");
            setTimeout(() => {
                client.end();
                process.exit(0);
            }, 5000);
        }
    }, 1000);
});
