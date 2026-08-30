from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_dev_key
from app.models.orders import Order
from app.models.deliveries import Delivery
from app.models.inventory import Inventory
from app.models.email_log import EmailLog
from app.models.reorder_config import ReorderConfig
from app.services.inventory_service import initialize_inventory

router = APIRouter(prefix="/dev", tags=["Development"])

# Setzt alle Daten zurück - geschützt durch eigenen DEV_RESET_KEY
@router.delete("/reset", dependencies=[Depends(verify_dev_key)])
def reset(db: Session = Depends(get_db)):

    # Alle Logs, Bestellungen und Reorder-Konfigurationen löschen
    db.query(EmailLog).delete()
    db.query(Delivery).delete()
    db.query(Order).delete()
    db.query(ReorderConfig).delete()

    # Sicherstellen, dass die Inventar-Grundeinträge existieren (z.B. wenn
    # die App bisher nur via Docker lief und die lokale Test-DB leer ist).
    initialize_inventory(db)

    # Bestand zurück auf Startwerte setzen
    colors = ["red", "blue", "white"]
    for color in colors:
        entry = db.query(Inventory).filter(Inventory.color == color).first()
        if entry:
            entry.supplier_stock = 100
            entry.customer_stock = 0

    db.commit()
    return {"message": "Reset successful - all data restored"}