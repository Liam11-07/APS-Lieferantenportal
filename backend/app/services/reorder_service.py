from sqlalchemy.orm import Session
from app.models.inventory import Inventory
from app.models.reorder_config import ReorderConfig
from app.models.orders import Order
from app.services.mqtt_service import publish_reorder_triggered
from app.services.email_service import send_reorder_status_update, CUSTOMER_EMAIL

# Prüft nach jeder Lieferung ob nachbestellt werden muss
def check_and_reorder(db: Session, color: str):

    # Aktuelle Konfiguration und Bestand holen
    # Nur "active" zählt - "pending", "paused" und "cancelled" lösen keine Nachbestellung aus
    config = db.query(ReorderConfig).filter(
        ReorderConfig.color == color,
        ReorderConfig.status == "active"
    ).first()

    # Keine Konfiguration oder nicht aktiv -> nichts tun
    if not config:
        return None

    inventory = db.query(Inventory).filter(Inventory.color == color).first()
    if not inventory:
        return None

    # Prüfe ob Kundenbestand unter Mindestbestand + Sicherheitsbestand gefallen ist
    threshold_value = config.minimum_stock + config.safety_stock
    if inventory.customer_stock >= threshold_value:
        return None

    # Verhindert doppelte Nachbestellungen => existiert bereits offene Auto-Bestellung für diese Farbe 
    # => keine weitere angelegt bis geliefert oder storniert
    existing_auto_order = db.query(Order).filter(
        Order.color == color,
        Order.source == "auto",
        Order.status == "open"
    ).first()
    if existing_auto_order:
        return None

    # Automatische Nachbestellung nur anlegen => noch keine Bestandsveränderung
    # Bestandsänderung wenn Admin die Lieferung über Deliver auslöst (wie bei normalen Bestellungen)
    new_order = Order(
        color=color,
        quantity=config.order_quantity,
        source="auto",                     # kennzeichnet automatische Bestellung
        status="open",
        note=f"Automatic Reorder - Stock was {inventory.customer_stock}"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # MQTT publischen - informiert dass eine automatische Bestellung angelegt wurde
    publish_reorder_triggered(color, config.order_quantity)
    return new_order


# Kunde stellt neue Anfrage (oder ändert eine bestehende) => status "pending",
# => muss vom Admin genehmigt werden - keine Mail hier, da der Kunde selbst
# der Auslöser ist (er weiß ja, dass er gerade etwas beantragt hat)
def submit_reorder_request(db: Session, data):
    config = db.query(ReorderConfig).filter(
        ReorderConfig.color == data.color
    ).first()

    if config:
        # Bestehende Konfiguration aktualisieren, zurück auf "pending" setzen
        config.minimum_stock = data.minimum_stock
        config.safety_stock = data.safety_stock
        config.order_quantity = data.order_quantity
        config.status = "pending"
    else:
        # Neue Konfiguration anlegen
        config = ReorderConfig(
            color=data.color,
            minimum_stock=data.minimum_stock,
            safety_stock=data.safety_stock,
            order_quantity=data.order_quantity,
            status="pending"
        )
        db.add(config)

    db.commit()
    db.refresh(config)
    return config


# Admin genehmigt eine offene Anfrage -> wird ab sofort für Nachbestellungen wirksam
async def approve_reorder(db: Session, color: str):
    config = db.query(ReorderConfig).filter(ReorderConfig.color == color).first()
    if not config:
        raise ValueError(f"No reorder request found for '{color}'")
    config.status = "active"
    db.commit()
    db.refresh(config)

    # Sofort prüfen ob der aktuelle Bestand bereits unter dem Schwellenwert liegt
    check_and_reorder(db, color)

    await send_reorder_status_update(db, CUSTOMER_EMAIL, color, "active")
    return config


# Admin lehnt eine offene Anfrage ab -> Kunde kann später erneut beantragen
async def reject_reorder(db: Session, color: str):
    config = db.query(ReorderConfig).filter(ReorderConfig.color == color).first()
    if not config:
        raise ValueError(f"No reorder request found for '{color}'")
    config.status = "cancelled"
    db.commit()
    db.refresh(config)

    await send_reorder_status_update(db, CUSTOMER_EMAIL, color, "cancelled")
    return config


# Admin pausiert eine bereits genehmigte (aktive) Konfiguration -
# send_email=False wird von order_service.cancel_order() genutzt, wenn eine
# Auto-Order storniert wird - dort reicht die Stornierungsmail allein
async def pause_reorder(db: Session, color: str, send_email: bool = True):
    config = db.query(ReorderConfig).filter(ReorderConfig.color == color).first()
    if not config or config.status != "active":
        raise ValueError(f"No active reorder configuration for '{color}'")
    config.status = "paused"
    db.commit()
    db.refresh(config)

    if send_email:
        await send_reorder_status_update(db, CUSTOMER_EMAIL, color, "paused")
    return config


# Admin nimmt eine pausierte Konfiguration wieder auf - prüft sofort ob der
# aktuelle Bestand bereits unter dem Schwellenwert liegt, wie bei approve_reorder(),
# sonst würde erst die nächste Lieferung zufällig die Prüfung auslösen
async def resume_reorder(db: Session, color: str):
    config = db.query(ReorderConfig).filter(ReorderConfig.color == color).first()
    if not config or config.status != "paused":
        raise ValueError(f"No paused reorder configuration for '{color}'")
    config.status = "active"
    db.commit()
    db.refresh(config)

    check_and_reorder(db, color)

    await send_reorder_status_update(db, CUSTOMER_EMAIL, color, "active")
    return config


# Admin beendet den Dauerauftrag endgültig -> Kunde müsste neu beantragen
async def terminate_reorder(db: Session, color: str):
    config = db.query(ReorderConfig).filter(ReorderConfig.color == color).first()
    if not config:
        raise ValueError(f"No reorder configuration for '{color}'")
    config.status = "cancelled"
    db.commit()
    db.refresh(config)

    await send_reorder_status_update(db, CUSTOMER_EMAIL, color, "cancelled")
    return config


# Alle Konfigurationen abrufen
def get_all_reorder_configs(db: Session):
    return db.query(ReorderConfig).all()