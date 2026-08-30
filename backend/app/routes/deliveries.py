from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.delivery_service import create_delivery, get_all_deliveries
from app.auth import verify_admin_key
from typing import List
from app.schemas.deliveries import DeliveryResponse

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])

# GET /deliveries/ - alle Lieferungen (bleibt offen, da auch für Kunden-Ansicht relevant)
@router.get("/", response_model=List[DeliveryResponse])
def all_deliveries(db: Session = Depends(get_db)):
    return get_all_deliveries(db)

# POST /deliveries/{order_id} - Lieferung für eine Bestellung auslösen
# Admin-geschützt, da dies den Bestand verändert (siehe auth.py: verify_admin_key)
# (Bestätigungsmail läuft automatisch im Service, siehe delivery_service.create_delivery())
@router.post("/{order_id}", response_model=DeliveryResponse, dependencies=[Depends(verify_admin_key)])
async def create_delivery_endpoint(order_id: int, db: Session = Depends(get_db)):
    try:
        return await create_delivery(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))