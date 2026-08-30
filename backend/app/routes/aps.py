from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_api_key
from app.schemas.orders import OrderCreate, OrderResponse
from app.schemas.inventory import InventoryResponse
from app.services.order_service import create_order, get_order_by_id
from app.services.inventory_service import get_inventory_by_color, update_customer_stock
from app.services.reorder_service import check_and_reorder
from app.services.mqtt_service import publish_inventory_updated
from pydantic import BaseModel

router = APIRouter(prefix="/api/aps", tags=["APS Schnittstelle"])

# Schema für Bestandsmeldung der APS
class StockUpdate(BaseModel):
    color: str
    current_stock: int

# APS gibt Bestellung auf
@router.post("/order", response_model=OrderResponse, dependencies=[Depends(verify_api_key)])
async def aps_create_order(order: OrderCreate, db: Session = Depends(get_db)):
    try:
        order.source = "aps"
        return await create_order(db, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# APS fragt Bestellstatus ab
@router.get("/status/{order_id}", dependencies=[Depends(verify_api_key)])
def aps_order_status(order_id: int, db: Session = Depends(get_db)):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_id": order.id,
        "status": order.status,
        "color": order.color,
        "quantity": order.quantity,
        "created_at": order.created_at,
        "delivered_at": order.delivered_at
    }

# APS fragt Bestand ab
@router.get("/inventory/{color}", response_model=InventoryResponse, dependencies=[Depends(verify_api_key)])
def aps_get_inventory(color: str, db: Session = Depends(get_db)):
    inventory = get_inventory_by_color(db, color)
    if not inventory:
        raise HTTPException(status_code=404, detail=f"Color '{color}' not found")
    return inventory

# APS meldet ihren realen Bestand zurück
@router.post("/stock-update", dependencies=[Depends(verify_api_key)])
def aps_stock_update(data: StockUpdate, db: Session = Depends(get_db)):
    try:
        inventory = update_customer_stock(db, data.color, data.current_stock)
    except ValueError as e:
        # update_customer_stock() wirft ValueError für zwei unterschiedliche Fälle:
        # "Farbe nicht gefunden" (404) und "Bestand negativ" (400)
        detail = str(e)
        status_code = 404 if "not found" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail)

    # MQTT publischen - informiert dass der Kundenbestand aktualisiert wurde
    publish_inventory_updated(inventory.color, inventory.supplier_stock, inventory.customer_stock)
    check_and_reorder(db, data.color)

    return {
        "message": "Stock updated successfully",
        "color": data.color,
        "current_stock": data.current_stock
    }