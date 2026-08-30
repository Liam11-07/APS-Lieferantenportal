from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class ReorderConfig(Base):
    __tablename__ = "reorder_config"

    id = Column(Integer, primary_key=True, index=True)
    color = Column(String, unique=True, nullable=False)
    minimum_stock = Column(Integer, default=10)
    safety_stock = Column(Integer, default=5)
    order_quantity = Column(Integer, default=20)
    status = Column(String, default="pending") # pending | active | paused | cancelled
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())