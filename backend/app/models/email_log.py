from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  
    # nullable weil nicht jede Mail eine Bestellung hat
    # Order_id = None bei ReorderConfig Mails 
    recipient = Column(String, nullable=False)
    type = Column(String, nullable=False) 
    # order_confirmation | delivery_confirmation | cancellation_confirmation 
    # | reorder_status_update
    status = Column(String, nullable=False) # sent | failed
    sent_at = Column(DateTime, default=func.now())
    error = Column(String, nullable=True)   # Fehlermeldung falls status = failed