from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine, SessionLocal
from app.routes import orders, inventory, deliveries, dev, reorder, csv_import, email_logs, aps
import app.models  # Import allein reicht: registriert alle Models bei Base.metadata (siehe models/__init__.py) - notwendig, damit create_all() unten sie kennt
from app.services.mqtt_service import connect_mqtt
import os

# Erstellt alle Tabellen automatisch beim Start (nur fehlende, ändert keine bestehenden Spalten)
Base.metadata.create_all(bind=engine)

# Lifespan-Handler ersetzt das alte @app.on_event("startup") 
# -> Code vor yield läuft beim Start,
# -> Code NACH yield läuft beim Herunterfahren
@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        from app.services.inventory_service import initialize_inventory
        initialize_inventory(db)
    finally:
        db.close()
    connect_mqtt()  # MQTT-Verbindung beim Start herstellen
    yield

app = FastAPI(
    title="Lieferantenportal APS",
    description="Digitales Lieferantenportal für die fischertechnik Agile Production Simulation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS erlaubt dem React-Frontend mit dem Backend zu reden.
# FRONTEND_URL kommt aus der .env - lokal localhost:5173
# .strip().rstrip("/") fängt typische .env-Fehler ab (Leerzeichen, CRLF-\r)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes registrieren
app.include_router(orders.router)
app.include_router(inventory.router)
app.include_router(deliveries.router)
app.include_router(dev.router)
app.include_router(reorder.router)
app.include_router(csv_import.router)
app.include_router(email_logs.router)
app.include_router(aps.router)

@app.get("/")
def root():
    return {"message": "Lieferantenportal APS - Online"}