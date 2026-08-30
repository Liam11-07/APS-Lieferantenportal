from sqlalchemy.orm import Session
from app.models.orders import Order
from app.models.inventory import Inventory
from app.schemas.orders import OrderCreate
from app.services.mqtt_service import publish_order_created
from app.services.email_service import send_order_confirmation, send_cancellation_confirmation, CUSTOMER_EMAIL
from app.services.reorder_service import pause_reorder

# Wie viel über den aktuellen Bestand hinaus darf zusätzlich bestellt werden
BACKORDER_PERCENT = 0.5      # 50% Aufschlag auf den aktuellen Bestand
BACKORDER_MINIMUM = 20       # aber mindestens 20 Stück extra, auch bei niedrigem Bestand (z.B. 1-2 Stück)

# Bestellung anlegen
async def create_order(db: Session, order_data: OrderCreate):
    inventory = db.query(Inventory).filter(
        Inventory.color == order_data.color
    ).first()

    if not inventory:
        raise ValueError(f"Color '{order_data.color}' not found in inventory")

    # Reservierte Menge = Summe aller offenen Bestellungen für diese Farbe
    open_orders_sum = db.query(Order).filter(
        Order.color == order_data.color,
        Order.status == "open"
    ).with_entities(Order.quantity).all()
    already_reserved = sum(q[0] for q in open_orders_sum)

    # Verfügbar = tatsächlicher Bestand minus bereits reservierte offene Bestellungen
    strictly_available = inventory.supplier_stock - already_reserved

    # Zusätzlicher Backorder-Puffer erlaubt Bestellungen über aktuellen Bestand hinaus,
    # da der Lieferant jederzeit per Restock nachproduzieren kann. 
    # (Ohne Puffer -> Bestellungen würden unnötig blockiert werden)
    backorder_buffer = max(inventory.supplier_stock * BACKORDER_PERCENT, BACKORDER_MINIMUM)
    max_orderable = strictly_available + backorder_buffer

    if order_data.quantity > max_orderable:
        raise ValueError(
            f"Order exceeds allowed backorder limit. "
            f"Max orderable right now: {int(max_orderable)}, Requested: {order_data.quantity}"
        )

    # Bestellung anlegen - Bestand wird NICHT hier verändert, sondern erst bei Lieferung
    new_order = Order(
        color=order_data.color,
        quantity=order_data.quantity,
        source=order_data.source or "manual",
        note=order_data.note,
        status="open"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # MQTT-Publish, damit APS die neue Bestellung sofort sieht
    publish_order_created(new_order.id, new_order.color, new_order.quantity, new_order.source)

    # E-Mail-Versand hier im Service statt in der Route, damit JEDER Aufrufer
    # (manuelle Bestellung, CSV-Import, APS) automatisch eine Bestätigung bekommt
    await send_order_confirmation(
        db=db,
        recipient=CUSTOMER_EMAIL,
        order_id=new_order.id,
        color=new_order.color,
        quantity=new_order.quantity
    )

    return new_order


# Alle Bestellungen abrufen
def get_all_orders(db: Session):
    return db.query(Order).order_by(Order.created_at.desc()).all()

# Einzelne Bestellung nach ID abrufen
def get_order_by_id(db: Session, order_id: int):
    return db.query(Order).filter(Order.id == order_id).first()

# Bestellung stornieren (nur wenn noch offen)
async def cancel_order(db: Session, order_id: int):
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise ValueError(f"Order {order_id} not found")

    if order.status != "open":
        raise ValueError(f"Order {order_id} cannot be cancelled - status is '{order.status}'")

    # Kein Bestand zurückzubuchen, da bei Bestellung nichts abgezogen wurde
    order.status = "cancelled"

    if order.source == "auto":
        # send_email=False: die Stornierungsmail unten reicht
        # -> zusätzliche Reorder-Status-Mail redundant
        try:
            await pause_reorder(db, order.color, send_email=False)
        except ValueError:
            pass

    db.commit()
    db.refresh(order)

    await send_cancellation_confirmation(
        db=db,
        recipient=CUSTOMER_EMAIL,
        order_id=order.id,
        color=order.color,
        quantity=order.quantity
    )

    return order