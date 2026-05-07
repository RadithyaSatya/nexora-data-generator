# Nexora Data Generator

Project ini sekarang dipisah jelas untuk mode development dan production:

- Mosquitto MQTT broker
- FastAPI control API
- Python simulation generator
- Next.js control panel

Generator sekarang memakai waktu nyata server. Timestamp payload mengikuti jam dunia nyata, bukan simulasi waktu yang lompat cepat.

## Struktur

```text
.
├── app/
├── backend/
├── frontend/
├── simulation/
├── mosquitto/config/mosquitto.conf
├── docker-compose.yml
├── package.json
└── requirements.txt
```

## Service yang tersedia

- Dev frontend: `http://localhost:3000`
- Dev backend: `http://localhost:8000`
- Production/public app via reverse proxy: `http://localhost`
- MQTT broker TCP: `localhost:1883`
- MQTT broker WebSocket: `localhost:9001`

## Cara menjalankan

### Development

Buat file env dev:

```bash
cp .env.dev.example .env
```

Jalankan:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Atau background:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Buka:

```text
http://localhost:3000/control
```

### Production

Sebelum menjalankan container production, buat file `.env` dari contoh:

```bash
cp .env.prod.example .env
```

Isi credential broker, domain, dan panel:

```env
MQTT_USERNAME=nexora
MQTT_PASSWORD=ganti-password-yang-kuat
APP_DOMAIN=panel.domainanda.com
MQTT_DOMAIN=mqtt.domainanda.com
APP_BASIC_AUTH_USERNAME=admin
APP_BASIC_AUTH_PASSWORD=ganti-password-panel
MQTT_PORT=1883
MQTT_WS_PORT=9001
PROXY_PORT=80
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://panel.domainanda.com
```

Jalankan:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Kalau ingin jalan di background:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Lalu buka:

```text
http://localhost/control
```

## Cara stop

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

Kalau ingin hapus image juga:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --rmi local
```

## Alur sistem

1. Frontend memanggil FastAPI
2. FastAPI publish command ke topic MQTT:
   `energy/{community_id}/{unit_id}/control`
3. Simulator subscribe ke:
   `energy/{community_id}/+/control`
4. Simulator update state device lalu terus publish consumption ke:
   `energy/{community_id}/{unit_id}/consumption`

## Endpoint backend

`POST /control`

```json
{
  "community_id": "C01",
  "unit_id": "U01",
  "device": "ac",
  "state": true
}
```

`POST /control-all`

```json
{
  "community_id": "C01",
  "device": "ac",
  "state": false
}
```

`GET /states?community_id=C01`

```json
{
  "community_id": "C01",
  "units": {
    "U01": {
      "ac": true,
      "lamp": false,
      "tv": false,
      "washing_machine": false,
      "charger": true
    }
  }
}
```

## Format payload consumption

Simulator sekarang publish breakdown konsumsi per device dalam JSON, contohnya:

```json
{
  "community_id": "C01",
  "unit_id": "U01",
  "timestamp": "2026-05-08T19:24:00",
  "base_load_kwh": 0.512,
  "device_consumption_kwh": {
    "ac": 0.941,
    "tv": 0.156,
    "washing_machine": 0.0,
    "charger": 0.072
  },
  "total_device_kwh": 1.169,
  "consumption_kwh": 1.681,
  "status": "high",
  "activities": ["AC", "TV", "Charging"],
  "devices": {
    "ac": true,
    "tv": true,
    "washing_machine": true,
    "charger": true
  }
}
```

Perilaku simulator saat ini:

- generator memakai jam server saat ini untuk field `timestamp`
- generator publish real-time setiap `60` detik secara default
- device menyala mengikuti pola jam normal harian, misalnya lamp lebih aktif sore-malam dan TV lebih aktif malam hari
- kontrol manual dari panel akan override perilaku otomatis untuk device yang dipilih
- device yang `OFF` akan mengirim nilai `0.0`
- device yang `ON` akan selalu mengirim konsumsi `kWh` pada setiap publish
- `base_load_kwh` tetap ada, tapi kecil, supaya unit yang idle masih terlihat hidup
- backend subscribe topic `consumption` untuk menyimpan snapshot state device terbaru
- halaman `/control` mengambil state awal dari backend dan refresh sinkronisasi tiap 2 detik

Kalau ingin ubah interval publish, set env `PUBLISH_INTERVAL_SECONDS`. Default-nya `60`.

## Test manual backend

Kontrol satu unit:

```bash
curl -X POST http://localhost:8000/control \
  -H "Content-Type: application/json" \
  -d '{"community_id":"C01","unit_id":"U01","device":"ac","state":true}'
```

Kontrol semua unit:

```bash
curl -X POST http://localhost:8000/control-all \
  -H "Content-Type: application/json" \
  -d '{"community_id":"C01","device":"ac","state":false}'
```

## Catatan implementasi

- Mosquitto sekarang wajib auth username/password
- Broker generate password file dari `MQTT_USERNAME` dan `MQTT_PASSWORD`
- `/control` dan `/api/*` sekarang dilindungi Basic Auth statik dari env
- Port host bisa diatur dari `.env`
- Frontend sekarang build production dengan `next build` lalu jalan via `next start`
- Reverse proxy Nginx jadi entrypoint publik utama
- `server_name` Nginx production dibentuk dari `APP_DOMAIN`
- Compose sekarang dipisah jadi mode `dev` dan `prod`
- Backend membaca `MQTT_HOST` dan `MQTT_PORT` dari environment
- Backend juga membaca `MQTT_USERNAME` dan `MQTT_PASSWORD`
- Backend juga membaca `CORS_ALLOW_ORIGINS`
- Simulator juga membaca `MQTT_HOST` dan `MQTT_PORT` dari environment
- Simulator juga membaca `MQTT_USERNAME` dan `MQTT_PASSWORD`
- Di dalam Docker network, kedua service diarahkan ke host `mqtt-broker`
- Frontend default memakai `NEXT_PUBLIC_API_BASE_URL=/api`

## Atur Port VPS

Port publik aplikasi sekarang diatur lewat `PROXY_PORT`. Frontend dan backend tidak perlu dibuka langsung ke internet.

Contoh:

```env
APP_DOMAIN=panel.domainanda.com
MQTT_DOMAIN=mqtt.domainanda.com
APP_BASIC_AUTH_USERNAME=admin
APP_BASIC_AUTH_PASSWORD=password-panel-yang-kuat
MQTT_PORT=1884
MQTT_WS_PORT=9002
PROXY_PORT=8080
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOW_ORIGINS=https://panel.domainanda.com
```

Lalu jalankan ulang:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Kalau deploy dengan domain, arahkan DNS subdomain-subdomain ini ke IP VPS:

- `APP_DOMAIN` untuk panel web
- `MQTT_DOMAIN` untuk broker MQTT

Lalu akses aplikasi lewat:

```text
https://panel.domainanda.com
```

Dan koneksi MQTT publik lewat:

```text
mqtt.domainanda.com:1884
```

atau WebSocket:

```text
mqtt.domainanda.com:9002
```

Saat membuka `/control`, browser akan meminta username/password Basic Auth dari:

```env
APP_BASIC_AUTH_USERNAME
APP_BASIC_AUTH_PASSWORD
```

## Subscribe MQTT Dengan Auth

Kalau subscribe dari host:

```bash
source .env
mosquitto_sub -h "$MQTT_DOMAIN" -p "$MQTT_PORT" -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" -t 'energy/#' -v
```

Kalau publish manual dari host:

```bash
source .env
mosquitto_pub -h "$MQTT_DOMAIN" -p "$MQTT_PORT" -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
  -t 'energy/C01/U01/control' \
  -m '{"device":"lamp","state":true}'
```

## File penting

- Control API: [backend/main.py](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/backend/main.py:1)
- Simulation generator: [simulation/generator.py](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/simulation/generator.py:1)
- Frontend page: [app/control/page.tsx](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/app/control/page.tsx:1)
- Base compose: [docker-compose.yml](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/docker-compose.yml:1)
- Dev compose: [docker-compose.dev.yml](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/docker-compose.dev.yml:1)
- Prod compose: [docker-compose.prod.yml](/Users/macbook/Workdir/Personal/Projects/nexora/data-generator/docker-compose.prod.yml:1)
