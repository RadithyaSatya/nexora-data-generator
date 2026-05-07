import json
import os
import random
import time
from datetime import datetime

import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
PUBLISH_INTERVAL_SECONDS = int(os.getenv("PUBLISH_INTERVAL_SECONDS", "60"))

COMMUNITY_ID = "C01"
TOTAL_UNITS = 20
DEVICE_KEYS = ("ac", "lamp", "tv", "washing_machine", "charger")

# State device terbaru per rumah. Nilai bisa berubah otomatis atau lewat kontrol manual.
unit_devices = {
    f"U{i:02d}": {device: False for device in DEVICE_KEYS}
    for i in range(1, TOTAL_UNITS + 1)
}

# Override manual per rumah. Jika ada nilainya, generator tidak akan mengubah device itu otomatis.
manual_overrides = {
    f"U{i:02d}": {device: None for device in DEVICE_KEYS}
    for i in range(1, TOTAL_UNITS + 1)
}


def get_base_load(hour: int) -> float:
    if 0 <= hour <= 4:
        return random.uniform(0.04, 0.08)
    if 5 <= hour <= 8:
        return random.uniform(0.07, 0.14)
    if 9 <= hour <= 16:
        return random.uniform(0.05, 0.11)
    if 17 <= hour <= 22:
        return random.uniform(0.08, 0.16)
    return random.uniform(0.05, 0.10)


def is_active(probability: float) -> bool:
    return random.random() < probability


def get_device_transition_rates(hour: int) -> dict[str, tuple[float, float]]:
    if 0 <= hour <= 4:
        return {
            "ac": (0.10, 0.04),
            "lamp": (0.03, 0.25),
            "tv": (0.01, 0.35),
            "washing_machine": (0.0, 0.7),
            "charger": (0.08, 0.05),
        }
    if 5 <= hour <= 8:
        return {
            "ac": (0.05, 0.12),
            "lamp": (0.12, 0.1),
            "tv": (0.03, 0.18),
            "washing_machine": (0.04, 0.25),
            "charger": (0.04, 0.1),
        }
    if 9 <= hour <= 16:
        return {
            "ac": (0.06, 0.08),
            "lamp": (0.01, 0.25),
            "tv": (0.02, 0.2),
            "washing_machine": (0.06, 0.15),
            "charger": (0.03, 0.1),
        }
    if 17 <= hour <= 22:
        return {
            "ac": (0.09, 0.05),
            "lamp": (0.18, 0.03),
            "tv": (0.12, 0.05),
            "washing_machine": (0.04, 0.18),
            "charger": (0.08, 0.06),
        }
    return {
        "ac": (0.08, 0.06),
        "lamp": (0.08, 0.08),
        "tv": (0.05, 0.1),
        "washing_machine": (0.02, 0.3),
        "charger": (0.05, 0.06),
    }


def update_unit_devices(unit_id: str, hour: int) -> None:
    transition_rates = get_device_transition_rates(hour)
    for device in DEVICE_KEYS:
        override_state = manual_overrides[unit_id][device]
        if override_state is not None:
            unit_devices[unit_id][device] = override_state
            continue

        turn_on_rate, turn_off_rate = transition_rates[device]
        current_state = unit_devices[unit_id][device]

        if current_state and is_active(turn_off_rate):
            unit_devices[unit_id][device] = False
        elif not current_state and is_active(turn_on_rate):
            unit_devices[unit_id][device] = True


def get_device_consumption(unit_id: str) -> tuple[dict[str, float], list[str]]:
    devices = unit_devices[unit_id]
    device_consumption = {device: 0.0 for device in DEVICE_KEYS}
    activities = []

    if devices["ac"]:
        device_consumption["ac"] = random.uniform(0.75, 1.35)
        activities.append("AC")

    if devices["lamp"]:
        device_consumption["lamp"] = random.uniform(0.05, 0.14)
        activities.append("Lamp")

    if devices["tv"]:
        device_consumption["tv"] = random.uniform(0.08, 0.22)
        activities.append("TV")

    if devices["charger"]:
        device_consumption["charger"] = random.uniform(0.03, 0.09)
        activities.append("Charging")

    if devices["washing_machine"]:
        device_consumption["washing_machine"] = random.uniform(0.4, 0.85)
        activities.append("Washing Machine")

    return device_consumption, activities


def get_status(kwh: float) -> str:
    if kwh >= 2.5:
        return "critical"
    if kwh >= 1.5:
        return "high"
    return "normal"


def on_connect(client, userdata, flags, reason_code, properties=None):
    print("Connected to MQTT broker")
    client.subscribe(f"energy/{COMMUNITY_ID}/+/control")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        parts = msg.topic.split("/")
        unit_id = parts[2]

        if unit_id not in unit_devices:
            return

        device = payload.get("device")
        state = payload.get("state")

        if device in DEVICE_KEYS and isinstance(state, bool):
            manual_overrides[unit_id][device] = state
            unit_devices[unit_id][device] = state
            print(f"[CONTROL] {unit_id} {device} => {state}")

    except Exception as exc:
        print("Invalid control message:", exc)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()

print("Nexora simulation generator started with real-time clock...")

while True:
    now = datetime.now()
    current_hour = now.hour

    for unit_number in range(1, TOTAL_UNITS + 1):
        unit_id = f"U{unit_number:02d}"
        update_unit_devices(unit_id, current_hour)

        house_factor = 0.8 + (unit_number % 6) * 0.12
        base_load_kwh = round(get_base_load(current_hour) * house_factor, 3)
        raw_device_consumption, activities = get_device_consumption(unit_id)
        device_consumption_kwh = {
            device: round(kwh * house_factor, 3)
            for device, kwh in raw_device_consumption.items()
        }
        total_device_kwh = round(sum(device_consumption_kwh.values()), 3)
        total_consumption_kwh = round(base_load_kwh + total_device_kwh, 3)

        payload = {
            "community_id": COMMUNITY_ID,
            "unit_id": unit_id,
            "timestamp": now.isoformat(),
            "base_load_kwh": base_load_kwh,
            "device_consumption_kwh": device_consumption_kwh,
            "total_device_kwh": total_device_kwh,
            "consumption_kwh": total_consumption_kwh,
            "status": get_status(total_consumption_kwh),
            "activities": activities,
            "devices": unit_devices[unit_id],
        }

        topic = f"energy/{COMMUNITY_ID}/{unit_id}/consumption"
        client.publish(topic, json.dumps(payload))

    print(f"Published real-time data at {now.isoformat()}")
    time.sleep(PUBLISH_INTERVAL_SECONDS)
