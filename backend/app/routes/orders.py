from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.orders import OrderCreate, OrderResponse
from app.services.order_service import create_order, get_all_orders, get_order_by_id, cancel_order
from typing import List

router = APIRouter(prefix="/orders", tags=["Orders"])

# POST /orders/ - neue Bestellung anlegen (Bestätigungsmail:
# läuft jetzt automatisch im Service, siehe order_service.create_order())
@router.post("/", response_model=OrderResponse)
async def create_order_endpoint(order: OrderCreate, db: Session = Depends(get_db)):
    try:
        return await create_order(db, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# GET /orders/ - alle Bestellungen
@router.get("/", response_model=List[OrderResponse])
def all_orders(db: Session = Depends(get_db)):
    return get_all_orders(db)

# GET /orders/{order_id} - einzelne Bestellung
@router.get("/{order_id}", response_model=OrderResponse)
def order_by_id(order_id: int, db: Session = Depends(get_db)):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# Bestellung stornieren (Stornierungsmail läuft jetzt automatisch im Service, siehe order_service.cancel_order())
@router.patch("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order_endpoint(order_id: int, db: Session = Depends(get_db)):
    try:
        return await cancel_order(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))