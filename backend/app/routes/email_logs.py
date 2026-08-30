from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.email_log import EmailLogResponse
from app.services.email_log_service import get_all_email_logs, delete_email_logs
from app.auth import verify_admin_key
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/email-logs", tags=["Email Logs"])

# Alle Email Logs abrufen
@router.get("/", response_model=List[EmailLogResponse])
def get_email_logs_endpoint(db: Session = Depends(get_db)):
    return get_all_email_logs(db)

# Schema für mehrere IDs auf einmal
class DeleteLogsRequest(BaseModel):
    ids: List[int]

# Mehrere ausgewählte Email Logs löschen -> Admin-geschützt, da dies Daten unwiderruflich löscht
@router.delete("/", dependencies=[Depends(verify_admin_key)])
def delete_email_logs_endpoint(data: DeleteLogsRequest, db: Session = Depends(get_db)):
    # synchronize_session=False: verhindert, dass SQLAlchemy nach dem Bulk-Delete
    # versucht, den Python-Objekt-Cache der Session mit der DB abzugleichen -
    # bei Bulk-Operationen unnötig und potenziell fehleranfällig
    deleted = delete_email_logs(db, data.ids)
    return {"message": f"{deleted} log(s) deleted"}