from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

# Was der Nutzer schickt um die Nachbestellung zu konfigurieren
class ReorderConfigCreate(BaseModel):
    color: str
    minimum_stock: int = Field(..., ge=0) # 0 erlaubt
    safety_stock: int = Field(..., ge=0) # 0 erlaubt
    order_quantity: int = Field(..., gt=0) # muss > 0 sein
    
class ReorderConfigResponse(BaseModel):
    id: int
    color: str
    minimum_stock: int
    safety_stock: int
    order_quantity: int
    status: str
    updated_at: datetime

    # Pydantic v2 Syntax, ersetzt das alte class Config
    model_config = ConfigDict(from_attributes=True)