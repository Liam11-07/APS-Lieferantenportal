from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

# Checkt ob alle Felder korrekt sind und konvertiert sie in die richtigen Datentypen
class OrderCreate(BaseModel): 
    color: str = Field(..., json_schema_extra={"example": "red"})
    quantity: int = Field(..., gt=0, json_schema_extra={"example": 5})  # gt=0: verhindert Bestellungen mit =< 0
    source: Optional[str] = "manual"
    note: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    color: str
    quantity: int
    status: str
    source: str
    note: Optional[str]
    created_at: datetime
    delivered_at: Optional[datetime]

    # Pydantic v2 Syntax, ersetzt das alte class Config
    model_config = ConfigDict(from_attributes=True)