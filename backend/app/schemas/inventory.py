from pydantic import BaseModel, ConfigDict
from datetime import datetime

# Bewusst kein InventoryUpdate-Schema mehr 
# minimum_stock, safety_stock, order_quantity ausschliesslich über ReorderConfig (siehe reorder_service.py)
class InventoryResponse(BaseModel):
    id: int
    color: str
    supplier_stock: int
    customer_stock: int
    updated_at: datetime

    # erlaubt Erstellung direkt aus SQLAlchemy-Objekten statt nur aus dicts
    # (Pydantic v2 Syntax, ersetzt das alte "class Config: from_attributes = True")
    model_config = ConfigDict(from_attributes=True)