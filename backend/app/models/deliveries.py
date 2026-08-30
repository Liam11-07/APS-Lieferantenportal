from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)  # 1 Delivery gehört zu genau 1 Order
    color = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String, default="delivered")
    delivered_at = Column(DateTime, default=func.now())