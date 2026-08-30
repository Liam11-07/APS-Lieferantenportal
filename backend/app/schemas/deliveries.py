from pydantic import BaseModel, ConfigDict
from datetime import datetime

# Kein DeliveryCreate-Schema => Deliveries nicht direkt per API angelegt => über delivery_service.py ausgelöst
# Schema für die API-Antwort einer Lieferung
class DeliveryResponse(BaseModel):
    id: int
    order_id: int
    color: str
    quantity: int
    status: str
    delivered_at: datetime

    # Pydantic v2 Syntax, ersetzt das alte class Config
    model_config = ConfigDict(from_attributes=True)