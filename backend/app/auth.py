from fastapi import Security, HTTPException
from fastapi.security.api_key import APIKeyHeader
import os
import secrets

# Fallback greift nur, falls APS_API_KEY in der .env fehlt - der echte, zufällig generierte Key liegt
# in der .env und wird auch auf der APS-Seite im X-API-Key-Header genutzt
API_KEY = os.getenv("APS_API_KEY", "aps-secret-key-123")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Prüft ob der API-Key korrekt ist
def verify_api_key(api_key: str = Security(api_key_header)):
    # secrets.compare_digest() vergleicht in konstanter Zeit (unabhängig davon,
    # wie viele Zeichen übereinstimmen) - schützt gegen Timing-Angriffe
    if api_key is None or not secrets.compare_digest(api_key, API_KEY):
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API Key"
        )
    return api_key


# Eigener, separater Key für den Dev-Reset-Endpunkt (APS-Key ist
# für die Anlage, Dev-Key nur für Datenbank komplett zurücksetzen)
DEV_RESET_KEY = os.getenv("DEV_RESET_KEY", "dev-reset-key-123")

def verify_dev_key(api_key: str = Security(api_key_header)):
    if api_key is None or not secrets.compare_digest(api_key, DEV_RESET_KEY):
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API Key"
        )
    return api_key


# Schützt admin Aktionen (Lieferung auslösen, Restock,
# Reorder-Verwaltung, Email-Logs löschen) 
# Bewusst ein eigener Key statt DEV_RESET_KEY
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "admin-secret-key-123")

def verify_admin_key(api_key: str = Security(api_key_header)):
    if api_key is None or not secrets.compare_digest(api_key, ADMIN_API_KEY):
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API Key"
        )
    return api_key