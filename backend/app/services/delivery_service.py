from sqlalchemy.orm import Session
from app.models.orders import Order
from app.models.deliveries import Delivery
from app.models.inventory import Inventory
from app.services.mqtt_service import publish_delivery_completed, publish_inventory_updated
from app.services.reorder_service import check_and_reorder
from app.services.email_service import send_delivery_confirmation, CUSTOMER_EMAIL
from datetime import datetime

# Hier passiert die eigentliche Logik => service = Gehirn der Anwendung
# => Daten werden hier verarbeitet, bevor sie an die API oder DB gehen

# Alle Lieferungen aus der DB holen
def get_all_deliveries(db: Session):
    return db.query(Delivery).order_by(Delivery.delivered_at.desc()).all()

# Lieferung für eine bestehende Bestellung erstellen
async def create_delivery(db: Session, order_id: int):

    # Bestellung suchen
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError(f"Order {order_id} not found")

    # Nur offene Bestellungen können geliefert werden
    if order.status != "open":
        raise ValueError(f"Order {order_id} is already {order.status}")

    # Inventar der bestellten Farbe holen
    inventory = db.query(Inventory).filter(Inventory.color == order.color).first()
    if not inventory:
        raise ValueError(f"Color '{order.color}' not found in inventory")

    # Prüfen ob genug Lieferantenbestand vorhanden ist um die Lieferung auszuführen
    if inventory.supplier_stock < order.quantity:
        raise ValueError(
            f"Not enough physical stock to deliver. Available: {inventory.supplier_stock}, Needed: {order.quantity}"
        )

    # Lieferung anlegen
    delivery = Delivery(
        order_id=order.id,
        color=order.color,
        quantity=order.quantity,
        status="delivered",
        delivered_at=datetime.now(),
    )
    db.add(delivery)

    # Bestände werden erst JETZT (bei tatsächlicher Lieferung) verändert (nicht schon bei Bestellung)
    inventory.supplier_stock -= order.quantity
    inventory.customer_stock += order.quantity
    # inventory.updated_at muss hier nicht gesetzt werden, da automatisch in
    # inventory.py (Model) mit onupdate=func.now()

    # Bestellung als geliefert markieren
    order.status = "delivered"
    order.delivered_at = datetime.now()     # notwendig!

    db.commit()
    db.refresh(delivery)

    # MQTT publischen
    publish_delivery_completed(delivery.order_id, delivery.color, delivery.quantity)
    publish_inventory_updated(inventory.color, inventory.supplier_stock, inventory.customer_stock)

    # Nach jeder Lieferung prüfen ob eine automatische Nachbestellung nötig ist
    check_and_reorder(db, order.color)

    # E-Mail-Versand hier im Service statt in der Route, idenitisch wie bei order_service.py -
    # so bekommt jeder Aufrufer von create_delivery() automatisch die Bestätigung
    await send_delivery_confirmation(
        db=db,
        recipient=CUSTOMER_EMAIL,
        order_id=delivery.order_id,
        color=delivery.color,
        quantity=delivery.quantity
    )

    return delivery