from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.inventory import InventoryResponse
from app.services.inventory_service import (
    get_all_inventory, get_inventory_by_color, restock_inventory
)
from app.auth import verify_admin_key
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# Nur für diesen Endpunkt genutzt => hier inline statt in schemas/inventory.py
class RestockRequest(BaseModel):
    amount: int

# GET /inventory/ - kompletter Bestand aller Farben
@router.get("/", response_model=List[InventoryResponse])
def all_inventory(db: Session = Depends(get_db)):
    return get_all_inventory(db)

# GET /inventory/{color} - Bestand einer einzelnen Farbe
@router.get("/{color}", response_model=InventoryResponse)
def quantity_by_color(color: str, db: Session = Depends(get_db)):
    inventory = get_inventory_by_color(db, color)
    if not inventory:
        raise HTTPException(status_code=404, detail=f"Color '{color}' not found")
    return inventory

# POST /inventory/{color}/restock - Lieferantenbestand manuell aufstocken
# -> Admin-geschützt, da dies den Bestand verändert (siehe auth.py: verify_admin_key)
@router.post("/{color}/restock", response_model=InventoryResponse, dependencies=[Depends(verify_admin_key)])
def restock(color: str, data: RestockRequest, db: Session = Depends(get_db)):
    try:
        return restock_inventory(db, color, data.amount)
    except ValueError as e:
        # Service wirft ValueError bei ungültiger Farbe/Menge -> als 400 an Client
        raise HTTPException(status_code=400, detail=str(e))