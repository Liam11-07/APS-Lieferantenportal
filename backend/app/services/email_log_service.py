from sqlalchemy.orm import Session
from app.models.email_log import EmailLog
from typing import List

# Alle Email-Logs abrufen
def get_all_email_logs(db: Session):
    return db.query(EmailLog).order_by(EmailLog.sent_at.desc()).all()

# Löschen von Email-Logs nach IDs
def delete_email_logs(db: Session, ids: List[int]):
    deleted = db.query(EmailLog).filter(EmailLog.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return deleted