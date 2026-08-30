from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from sqlalchemy.orm import Session
from app.models.email_log import EmailLog
import os
from dotenv import load_dotenv

load_dotenv()
CUSTOMER_EMAIL = os.getenv("CUSTOMER_EMAIL", "customer@example.com")

# Konfiguration aus .env laden
# MAIL_STARTTLS/MAIL_SSL_TLS: os.getenv() liefert immer String zurück,
# -> "False" ist als String true -> auf "true" vergleichen
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", "test@test.com"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", "test"),
    MAIL_FROM=os.getenv("MAIL_FROM", "test@test.com"),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "localhost"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", "1025")),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "False").lower() == "true",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False").lower() == "true",
    USE_CREDENTIALS=os.getenv("MAIL_USE_CREDENTIALS", "False").lower() == "true",
)

fm = FastMail(conf)

# Hilfsfunktion zum Loggen in die DB
def log_email(db: Session, recipient: str, type: str, status: str, order_id: int = None, error: str = None):
    log = EmailLog(
        order_id=order_id,
        recipient=recipient,
        type=type,
        status=status,
        error=error
    )
    db.add(log)
    db.commit()

# Bestellbestätigung senden
async def send_order_confirmation(db: Session, recipient: str, order_id: int, color: str, quantity: int):
    try:
        message = MessageSchema(
            subject=f"Order Confirmation #{order_id}",
            recipients=[recipient],
            body=f"""
            <h2>Order Confirmation</h2>
            <p>Your order has been successfully placed.</p>
            <ul>
                <li><b>Order ID:</b> {order_id}</li>
                <li><b>Color:</b> {color}</li>
                <li><b>Quantity:</b> {quantity}</li>
                <li><b>Status:</b> Open</li>
            </ul>
            <p>You will be notified once your order has been delivered.</p>
            """,
            subtype="html"
        )
        await fm.send_message(message)
        log_email(db, recipient, "order_confirmation", "sent", order_id=order_id)

    except Exception as e:
        log_email(db, recipient, "order_confirmation", "failed", order_id=order_id, error=str(e))

# Lieferbestätigung senden
async def send_delivery_confirmation(db: Session, recipient: str, order_id: int, color: str, quantity: int):
    try:
        message = MessageSchema(
            subject=f"Delivery Confirmation #{order_id}",
            recipients=[recipient],
            body=f"""
            <h2>Delivery Confirmation</h2>
            <p>Your order has been delivered.</p>
            <ul>
                <li><b>Order ID:</b> {order_id}</li>
                <li><b>Color:</b> {color}</li>
                <li><b>Quantity:</b> {quantity}</li>
                <li><b>Status:</b> Delivered</li>
            </ul>
            """,
            subtype="html"
        )
        await fm.send_message(message)
        log_email(db, recipient, "delivery_confirmation", "sent", order_id=order_id)

    except Exception as e:
        log_email(db, recipient, "delivery_confirmation", "failed", order_id=order_id, error=str(e))

# Stornierungsbestätigung senden
async def send_cancellation_confirmation(db: Session, recipient: str, order_id: int, color: str, quantity: int):
    try:
        message = MessageSchema(
            subject=f"Order Cancellation #{order_id}",
            recipients=[recipient],
            body=f"""
            <h2>Order Cancellation</h2>
            <p>Your order has been successfully cancelled.</p>
            <ul>
                <li><b>Order ID:</b> {order_id}</li>
                <li><b>Color:</b> {color}</li>
                <li><b>Quantity:</b> {quantity}</li>
                <li><b>Status:</b> Cancelled</li>
            </ul>
            """,
            subtype="html"
        )
        await fm.send_message(message)
        log_email(db, recipient, "cancellation_confirmation", "sent", order_id=order_id)

    except Exception as e:
        log_email(db, recipient, "cancellation_confirmation", "failed", order_id=order_id, error=str(e))

# E-Mail bei Änderung des Reorder-Status
async def send_reorder_status_update(db: Session, recipient: str, color: str, status: str):
    status_text = {
        "active": "approved and is now active",
        "paused": "paused",
        "cancelled": "ended",
    }.get(status, status)

    try:
        message = MessageSchema(
            subject=f"Auto-Reorder Update - {color}",
            recipients=[recipient],
            body=f"""
            <h2>Auto-Reorder Status Update</h2>
            <p>Your auto-reorder configuration for <b>{color}</b> has been {status_text}.</p>
            """,
            subtype="html"
        )
        await fm.send_message(message)
        log_email(db, recipient, "reorder_status_update", "sent")
    except Exception as e:
        log_email(db, recipient, "reorder_status_update", "failed", error=str(e))