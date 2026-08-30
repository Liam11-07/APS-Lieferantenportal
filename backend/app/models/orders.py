from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    # Spaltendefinition
    id = Column(Integer, primary_key=True, index=True)
    color = Column(String, nullable=False)  # kein FK zu inventory.color, Validierung läuft im Service-Layer
    quantity = Column(Integer, nullable=False)
    status = Column(String, default="open")  # open | delivered | cancelled
    source = Column(String, default="manual")  # manual | csv | auto | aps
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    delivered_at = Column(DateTime, nullable=True)