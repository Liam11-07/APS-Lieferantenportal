from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.csv_service import process_csv

router = APIRouter(prefix="/import", tags=["CSV Import"])

# Bestätigungsmails werden jetzt automatisch pro erfolgreicher Zeile verschickt
# -> process_csv() ruft intern create_order() auf -> sendet die Mail selbst
@router.post("/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    return await process_csv(db, content)