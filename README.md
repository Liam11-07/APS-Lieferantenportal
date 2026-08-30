# Lieferantenportal APS

Digitales Lieferantenportal für die fischertechnik Agile Production Simulation (APS).
Simuliert die Kommunikation zwischen einem Lieferanten und der automatisierten Produktionsanlage
=> Bestellungen, Lagerverwaltung, automatische Nachbestellung, E-Mail-Benachrichtigungen und REST/MQTT-Anbindung.

## Architektur

- Backend: Python, FastAPI, SQLAlchemy, SQLite
- REST: FastAPI-Endpunkte für Bestellungen, Lagerverwaltung und Reorder-Logik;
  eigene Schnittstelle (`/api/aps/*`) zur späteren Anbindung der physischen APS
- Frontend: React (Vite), Tailwind CSS => Kunden-Portal (Bestellungen) und Admin-Portal (Lieferant)
- MQTT: eigener Mosquitto-Broker für die Anbindung an die APS
- E-Mail: SMTP-Benachrichtigungen bei Bestellungen und Lieferungen
  (SMTP = Simple Mail Transfer Protocol, das Standardprotokoll zum Versenden von E-Mails)

Alles läuft lokal via Docker Compose

## Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installiert und gestartet
- Git

Für lokalen Betrieb:

- Python 3.12 (die `requirements.txt` ist auf 3.12 gepinnt – ältere Versionen scheitern beim `pip install`)
- Node.js 20 oder neuer (für die Frontend-E2E-Tests mit Playwright)

## Einrichtung

### 1. Repository klonen

```bash
git clone <repo-url>
cd <repo-ordner>
```

### 2. Umgebungsvariablen anlegen

Es gibt drei `.env.example`-Dateien im Projekt (`backend/`, `frontend/`, Hauptordner).
Jeweils in `.env` umbenennen und die Platzhalter durch echte Werte ersetzen:

- `backend/.env`: SMTP-Zugangsdaten (`MAIL_*`), `CUSTOMER_EMAIL`, `MQTT_PASSWORD`, `APS_API_KEY`, `DEV_RESET_KEY`, `ADMIN_API_KEY`
- `frontend/.env`: `VITE_ADMIN_API_KEY` — muss identisch mit `ADMIN_API_KEY` aus `backend/.env` sein
- `.env` (Hauptordner): `MQTT_PASSWORD` — muss identisch mit `MQTT_PASSWORD` aus `backend/.env` sein

Hinweis (Windows): Die `.env`-Dateien mit LF-Zeilenenden speichern, nicht CRLF => sonst kann sich ein unsichtbares `\r` an einen Wert hängen. In VS Code unten rechts in der Statusleiste auf „CRLF" klicken und auf „LF" stellen.

### 3. Mosquitto-Zugangsdaten anlegen

Der MQTT-Broker verlangt Authentifizierung. Passwort-Datei einmalig erzeugen:

macOS / Linux:

```bash
docker run -it --rm -v $(pwd)/backend/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -c /mosquitto/config/passwd portal_backend
```

Windows (PowerShell) – alles in einer Zeile, kein `\`:

```powershell
docker run -it --rm -v "${PWD}/backend/mosquitto:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd -c /mosquitto/config/passwd portal_backend
```

Das eingegebene Passwort muss mit dem `MQTT_PASSWORD`-Wert aus Schritt 2 übereinstimmen (in beiden `.env`-Dateien).

### 4. Starten

```bash
docker compose up --build
```

Baut und startet Backend, Frontend und Mosquitto gemeinsam. Der erste Start dauert wegen des Image-Builds etwas länger,
danach reicht `docker compose up` (ohne `--build`) für schnelleres Wiederstarten.

## Erreichbare URLs

| Service                    | URL                         |
| -------------------------- | --------------------------- |
| Frontend (Kunden-Portal)   | http://localhost:5173       |
| Frontend (Admin-Portal)    | http://localhost:5173/admin |
| Backend / Swagger-API-Doku | http://localhost:8000/docs  |
| MQTT-Broker                | `localhost:1883`            |

## Beenden

```bash
docker compose down
```

Stoppt alle Container, Daten bleiben erhalten. Für einen kompletten Reset inkl. Löschen aller Daten:

```bash
docker compose down -v
```

## E-Mail-Benachrichtigungen

Standardmäßig ist kein Mailserver konfiguriert (`MAIL_SERVER=localhost:1025`). Das Portal
läuft trotzdem normal => jeder Sendeversuch wird nur als Eintrag mit Status `failed` in den
E-Mail-Logs gespeichert, es stürzt nichts ab. Wenn man die Mails wirklich erhalten will hat
man 2 Optionen:

### Variante A: Mailpit (lokaler Test-Posteingang, kein echter Versand)

Service in `docker-compose.yml` ergänzen:

```yaml
mailpit:
  image: axllent/mailpit:latest
  ports:
    - "8025:8025" # Web-Oberfläche
    - "1025:1025" # SMTP
```

In `backend/.env`:

```
MAIL_SERVER=mailpit
```

Alle Mails landen dann unter http://localhost:8025, der Log-Status wird `sent`.

### Variante B: Echter Versand an eine reale Adresse (Beispiel Gmail)

1. Google-App-Passwort erstellen:
   https://myaccount.google.com/apppasswords
2. In `backend/.env`:

   ```
   MAIL_USERNAME=sender.adresse@gmail.com
   MAIL_PASSWORD=<16-stelliges App-Passwort>
   MAIL_FROM=sender.adresse@gmail.com
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_STARTTLS=True
   MAIL_SSL_TLS=False
   MAIL_USE_CREDENTIALS=True
   CUSTOMER_EMAIL=empfänger@example.com
   ```

   `CUSTOMER_EMAIL` ist der Empfänger der Bestell-/Liefer-Benachrichtigungen.

## Alternative: Lokal ohne Docker (schnelles Testen/Debugging)

Für schnelle Iterationen ohne Docker-Rebuild, z. B. beim Debuggen einzelner Endpunkte:

Backend:

macOS / Linux:

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Windows (PowerShell):

```powershell
cd backend
py -3.12 -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Falls PowerShell die Aktivierung mit „… die Ausführung von Skripts ist auf diesem System deaktiviert" blockiert, einmalig:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Hinweis: `MQTT_BROKER_URL` in `backend/.env` muss dafür auf `localhost` stehen (nicht `mosquitto`, das gilt nur innerhalb
des Docker-Netzwerks). Falls kein Mosquitto läuft, startet das Backend trotzdem — MQTT-Nachrichten werden dann einfach nicht
zugestellt, es gibt keinen Absturz.

## Tests

### Backend (57 Tests)

Am einfachsten im laufenden Container – kein lokales Python/venv nötig:

```bash
docker compose exec backend pytest -v
```

Alternativ lokal:

macOS / Linux:

```bash
cd backend
source venv/bin/activate
pytest -v
```

Windows (PowerShell):

```powershell
cd backend
venv\Scripts\Activate.ps1
pytest -v
```

### Frontend (34 E2E-Tests mit Playwright)

Benötigt Node 20+. Das Backend muss bereits laufen (z. B. `docker compose up` in einem
anderen Terminal). Zwei Tests rufen admin-geschützte Routen direkt auf, daher beide Keys als
Umgebungsvariablen setzen (Werte aus `backend/.env`).

macOS / Linux:

```bash
cd frontend
npm install
npx playwright install chromium
export DEV_RESET_KEY=<Wert aus backend/.env>
export ADMIN_API_KEY=<Wert aus backend/.env>
npx playwright test
```

Windows (PowerShell):

```powershell
cd frontend
npm install
npx playwright install chromium
$env:DEV_RESET_KEY = "<Wert aus backend/.env>"
$env:ADMIN_API_KEY = "<Wert aus backend/.env>"
npx playwright test
```

## MQTT manuell testen

Um zu prüfen, ob Nachrichten wirklich beim Broker ankommen (simuliert die Sicht der APS):

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t "supplier/#" -v -u portal_backend -P <MQTT-Passwort>
```

Danach im Portal eine Bestellung anlegen oder eine Lieferung bestätigen — die entsprechende Nachricht sollte im Terminal erscheinen.

## Hinweise

- Externe Anbindung per REST: Andere Systeme (z.B. die APS) können über den eigenen Router `/api/aps/*` Bestellungen
  aufgeben oder Bestände melden — komplett getrennt von den normalen Frontend-Endpunkten. Authentifizierung erfolgt über den
  Header `X-API-Key` mit dem Wert aus `APS_API_KEY` (`backend/.env`). Alle verfügbaren Endpunkte samt Beispiel-Payloads sind
  unter `http://localhost:8000/docs` einsehbar und dort auch direkt testbar. Beispiel:

```bash
  curl -X POST http://localhost:8000/api/aps/stock-update \
    -H "X-API-Key: <APS_API_KEY aus backend/.env>" \
    -H "Content-Type: application/json" \
    -d '{"color": "red", "current_stock": 8}'
```

- Wie die APS das Portal anbindet: Die APS-Seite läuft nicht als Teil dieses Repos, sondern als eigenes kleines
  Python-Script ("Adapter") auf dem Raspberry Pi der Anlage. Es macht zwei Dinge parallel: Bestände per REST an das Portal
  melden, und per MQTT auf Ereignisse vom Portal hören. Minimales Beispiel:

```python
  import requests
  import paho.mqtt.client as mqtt
  import json

  PORTAL_URL = "http://<Portal-Host>:8000"
  API_KEY = "<APS_API_KEY aus backend/.env>"
  MQTT_BROKER = "<Portal-Host>"
  MQTT_USERNAME = "<MQTT-Benutzername>"
  MQTT_PASSWORD = "<MQTT-Passwort>"

  # REST: Bestand ans Portal melden
  def report_stock(color: str, current_stock: int):
      response = requests.post(
          f"{PORTAL_URL}/api/aps/stock-update",
          json={"color": color, "current_stock": current_stock},
          headers={"X-API-Key": API_KEY},
          timeout=5,
      )
      response.raise_for_status()
      return response.json()

  # MQTT: auf Portal-Ereignisse hören
  def on_message(client, userdata, message):
      data = json.loads(message.payload)
      print(f"[{message.topic}] {data}")
      # hier je nach Topic die passende Aktion in der APS auslösen

  client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
  client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
  client.on_message = on_message
  client.connect(MQTT_BROKER, 1883)
  client.subscribe("supplier/#")
  client.loop_forever()
```

Wichtig: Dieses Script ist nur ein Beispiel zur Veranschaulichung, nicht Teil dieses Repositories.

- Zum Zurücksetzen der Demo-Daten steht `DELETE /dev/reset` zur Verfügung (geschützt durch `DEV_RESET_KEY`).

## Development

- Code-Formatierung: [Prettier](https://prettier.io/)
- Linting: ESLint
