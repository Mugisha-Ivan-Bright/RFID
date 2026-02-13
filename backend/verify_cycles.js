const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://broker.benax.rw';
const TEAM_ID = 'ivan_bright';
const TOPIC = `rfid/${TEAM_ID}/card/status`;

const client = mqtt.connect(MQTT_BROKER);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function simulateCard(uid, durationSec) {
    console.log(`\n--- Simulating Card: ${uid} ---`);
    for (let i = 0; i < durationSec; i++) {
        const payload = JSON.stringify({
            uid: uid,
            balance: 100,
            status: "detected",
            ts: Date.now()
        });
        client.publish(TOPIC, payload);
        console.log(`[${i + 1}/${durationSec}] Sent detected for ${uid}`);
        await sleep(1000);
    }
}

client.on('connect', async () => {
    console.log(`Connected to ${MQTT_BROKER}`);

    // Cycle 1
    await simulateCard("CARD_A", 5);
    console.log(">>> REMOVED Card A. Expect clear in ~3s. Waiting 6s...");
    await sleep(6000);

    // Cycle 2
    await simulateCard("CARD_B", 5);
    console.log(">>> REMOVED Card B. Expect clear in ~3s. Waiting 6s...");
    await sleep(6000);

    // Cycle 3
    await simulateCard("CARD_A", 5);
    console.log(">>> REMOVED Card A again. Expect clear in ~3s.");
    await sleep(5000);

    console.log("\nTest complete.");
    client.end();
    process.exit(0);
});
