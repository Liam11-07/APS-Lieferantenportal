from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

# Nutzung von Sqlalchemy, 
# => erstellt automatisch die lieferanten.db
# nicht direkt SQL sondern beschreibung wie DB aussehen soll

# Erbt von Base -> wird als Tabelle "inventory" angelegt
class Inventory(Base):
    __tablename__ = "inventory"

    # Spaltendefinition
    id = Column(Integer, primary_key=True, index=True)
    color = Column(String, unique=True, nullable=False)
    supplier_stock = Column(Integer, default=0)
    customer_stock = Column(Integer, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())