from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

# Kein EmailLogCreate-Schema => EmailLogs über log_email() erzeugt => nicht per API
class EmailLogResponse(BaseModel):
    id: int
    order_id: Optional[int]
    recipient: str
    type: str
    status: str
    sent_at: datetime
    error: Optional[str]

    # Pydantic v2 Syntax, ersetzt das alte class Config
    model_config = ConfigDict(from_attributes=True)