from sqlalchemy.orm import Session
from app.models.inventory import Inventory

# Alle Inventar-Einträge abrufen
def get_all_inventory(db: Session):
    return db.query(Inventory).all()

# Einzelnen Inventar-Eintrag nach Farbe abrufen
def get_inventory_by_color(db: Session, color: str):
    return db.query(Inventory).filter(Inventory.color == color).first()

# Lieferantenbestand manuell aufstocken (z.B. neue Produktion/Einkauf)
def restock_inventory(db: Session, color: str, amount: int):
    inventory = db.query(Inventory).filter(Inventory.color == color).first()
    if not inventory:
        raise ValueError(f"Color '{color}' not found")
    if amount <= 0:
        raise ValueError("Restock amount must be greater than 0")

    inventory.supplier_stock += amount
    # updated_at muss nicht gesetzt werden, da automatisch in inventory.py (Model) mit onupdate=func.now() 
    db.commit()
    db.refresh(inventory)
    return inventory

# Beim ersten Start Grundbestand für alle Farben anlegen
def initialize_inventory(db: Session):
    colors = ["red", "blue", "white"]  # feste Farbpalette, durchgehend Englisch im gesamten System
    for color in colors:
        exists = db.query(Inventory).filter(Inventory.color == color).first()
        if not exists:
            eintrag = Inventory(
                color=color,
                supplier_stock=100,
                customer_stock=0
            )
            db.add(eintrag)
    db.commit()

# APS meldet ihren realen Bestand zurück - setzt customer_stock direkt
def update_customer_stock(db: Session, color: str, new_stock: int):
    inventory = db.query(Inventory).filter(Inventory.color == color).first()
    if not inventory:
        raise ValueError(f"Color '{color}' not found")
    if new_stock < 0:
        raise ValueError("Stock cannot be negative")

    inventory.customer_stock = new_stock
    # updated_at muss nicht gesetzt werden, da automatisch in inventory.py (Model) mit onupdate=func.now() 
    db.commit()
    db.refresh(inventory)
    return inventory