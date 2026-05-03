import json
import os
from contextlib import asynccontextmanager

import paho.mqtt.client as mqtt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "*")
VALID_DEVICES = {"ac", "lamp", "tv", "washing_machine", "charger"}
TOTAL_UNITS = 20


class ControlRequest(BaseModel):
    community_id: str = Field(..., min_length=1)
    unit_id: str = Field(..., pattern=r"^U\d{2}$")
    device: str
    state: bool


class ControlAllRequest(BaseModel):
    community_id: str = Field(..., min_length=1)
    device: str
    state: bool


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

if MQTT_USERNAME and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)


def normalize_device(device: str) -> str:
    normalized_device = device.strip().lower()
    if normalized_device not in VALID_DEVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported device: {device}")
    return normalized_device


def validate_unit_id(unit_id: str) -> None:
    try:
        unit_number = int(unit_id[1:])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid unit_id: {unit_id}") from exc

    if not 1 <= unit_number <= TOTAL_UNITS:
        raise HTTPException(status_code=400, detail=f"Unknown unit_id: {unit_id}")


def publish_control(community_id: str, unit_id: str, device: str, state: bool) -> None:
    validate_unit_id(unit_id)
    normalized_device = normalize_device(device)

    topic = f"energy/{community_id}/{unit_id}/control"
    payload = json.dumps({"device": normalized_device, "state": state})
    result = mqtt_client.publish(topic, payload)

    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        raise HTTPException(status_code=500, detail="Failed to publish MQTT control message")


def get_allowed_origins() -> list[str]:
    origins = [origin.strip() for origin in CORS_ALLOW_ORIGINS.split(",") if origin.strip()]
    return origins or ["*"]


@asynccontextmanager
async def lifespan(_: FastAPI):
    mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
    mqtt_client.loop_start()
    try:
        yield
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


app = FastAPI(title="Simulation Control API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/control")
async def control_unit(payload: ControlRequest):
    publish_control(
        community_id=payload.community_id,
        unit_id=payload.unit_id,
        device=payload.device,
        state=payload.state,
    )
    return {
        "success": True,
        "message": f"Control sent to {payload.unit_id}",
        "data": payload.model_dump(),
    }


@app.post("/control-all")
async def control_all_units(payload: ControlAllRequest):
    for unit_number in range(1, TOTAL_UNITS + 1):
        unit_id = f"U{unit_number:02d}"
        publish_control(
            community_id=payload.community_id,
            unit_id=unit_id,
            device=payload.device,
            state=payload.state,
        )

    return {
        "success": True,
        "message": f"Control sent to all units for device {payload.device}",
        "data": payload.model_dump(),
        "total_units": TOTAL_UNITS,
    }
