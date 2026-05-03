import json
import os
import time
import random
from datetime import datetime, timedelta
import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

COMMUNITY_ID = "C01"
TOTAL_UNITS = 20

# Simulasi state device per rumah
unit_devices = {
    f"U{i:02d}": {
        "ac": False,
        "lamp": False,
        "tv": False,
        "washing_machine": False,
        "charger": False
    }
    for i in range(1, TOTAL_UNITS + 1)
}

# Waktu simulasi
sim_time = datetime(2026, 5, 3, 0, 0, 0)


def get_base_load(hour: int) -> float:
    if 0 <= hour <= 5:
        return random.uniform(0.03, 0.08)
    elif 6 <= hour <= 8:
        return random.uniform(0.05, 0.10)
    elif 9 <= hour <= 16:
        return random.uniform(0.04, 0.09)
    elif 17 <= hour <= 22:
        return random.uniform(0.06, 0.12)
    else:
        return random.uniform(0.04, 0.09)


def get_device_consumption(unit_id: str, hour: int) -> tuple[dict[str, float], list[str]]:
    devices = unit_devices[unit_id]
    device_consumption = {
        "ac": 0.0,
        "lamp": 0.0,
        "tv": 0.0,
        "washing_machine": 0.0,
        "charger": 0.0,
    }
    activities = []

    if devices["ac"]:
        device_consumption["ac"] = random.uniform(0.75, 1.35)
        activities.append("AC")

    if devices["lamp"]:
        device_consumption["lamp"] = random.uniform(0.06, 0.16)
        activities.append("Lamp")

    if devices["tv"]:
        device_consumption["tv"] = random.uniform(0.12, 0.28)
        activities.append("TV")

    if devices["charger"]:
        device_consumption["charger"] = random.uniform(0.04, 0.12)
        activities.append("Charging")

    if devices["washing_machine"]:
        device_consumption["washing_machine"] = random.uniform(0.45, 0.90)
        activities.append("Washing Machine")

    return device_consumption, activities


def get_status(kwh: float) -> str:
    if kwh >= 2.5:
        return "critical"
    elif kwh >= 1.5:
        return "high"
    return "normal"


def on_connect(client, userdata, flags, reason_code, properties=None):
    print("Connected to MQTT broker")
    client.subscribe(f"energy/{COMMUNITY_ID}/+/control")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())

        # topic: energy/C01/U01/control
        parts = msg.topic.split("/")
        unit_id = parts[2]

        if unit_id not in unit_devices:
            return

        device = payload.get("device")
        state = payload.get("state")

        if device in unit_devices[unit_id] and isinstance(state, bool):
            unit_devices[unit_id][device] = state
            print(f"[CONTROL] {unit_id} {device} => {state}")

    except Exception as e:
        print("Invalid control message:", e)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()

print("Nexora simulation generator started...")

while True:
    global_hour = sim_time.hour

    for unit_number in range(1, TOTAL_UNITS + 1):
        unit_id = f"U{unit_number:02d}"

        house_factor = 0.8 + (unit_number % 6) * 0.12
        base_load_kwh = round(get_base_load(global_hour) * house_factor, 3)
        raw_device_consumption, activities = get_device_consumption(unit_id, global_hour)
        device_consumption_kwh = {
            device: round(kwh * house_factor, 3)
            for device, kwh in raw_device_consumption.items()
        }
        total_device_kwh = round(sum(device_consumption_kwh.values()), 3)
        total_consumption_kwh = round(base_load_kwh + total_device_kwh, 3)

        payload = {
            "community_id": COMMUNITY_ID,
            "unit_id": unit_id,
            "timestamp": sim_time.isoformat(),
            "base_load_kwh": base_load_kwh,
            "device_consumption_kwh": device_consumption_kwh,
            "total_device_kwh": total_device_kwh,
            "consumption_kwh": total_consumption_kwh,
            "status": get_status(total_consumption_kwh),
            "activities": activities,
            "devices": unit_devices[unit_id]
        }

        topic = f"energy/{COMMUNITY_ID}/{unit_id}/consumption"
        client.publish(topic, json.dumps(payload))

    print(f"Published data at simulation time: {sim_time}")

    # 1 detik real-time = 1 jam simulasi
    sim_time += timedelta(hours=1)

    time.sleep(1)
