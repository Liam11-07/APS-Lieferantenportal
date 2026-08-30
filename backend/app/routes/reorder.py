from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.reorder_config import ReorderConfigCreate, ReorderConfigResponse
from app.services.reorder_service import (
    submit_reorder_request, get_all_reorder_configs,
    approve_reorder, reject_reorder, pause_reorder, resume_reorder, terminate_reorder
)
from app.auth import verify_admin_key
from typing import List

router = APIRouter(prefix="/reorder", tags=["Auto-Reorder"])

# GET /reorder/ - alle Reorder-Konfigurationen
@router.get("/", response_model=List[ReorderConfigResponse])
def all_configs(db: Session = Depends(get_db)):
    return get_all_reorder_configs(db)

# Kunde stellt eine Anfrage - keine Mail hier, da submit_reorder_request()
# selbst keine verschickt (der Kunde ist ja der Auslöser)
@router.post("/", response_model=ReorderConfigResponse)
def submit_request(data: ReorderConfigCreate, db: Session = Depends(get_db)):
    try:
        return submit_reorder_request(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Admin genehmigt eine Anfrage (Status-Update-Mail läuft jetzt automatisch
# im Service, siehe reorder_service.approve_reorder())
# -> Admin-geschützt, da dies Bestellungen auslösen kann (siehe auth.py: verify_admin_key)
@router.patch("/{color}/approve", response_model=ReorderConfigResponse, dependencies=[Depends(verify_admin_key)])
async def approve(color: str, db: Session = Depends(get_db)):
    try:
        return await approve_reorder(db, color)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# Admin lehnt eine Anfrage ab
@router.patch("/{color}/reject", response_model=ReorderConfigResponse, dependencies=[Depends(verify_admin_key)])
async def reject(color: str, db: Session = Depends(get_db)):
    try:
        return await reject_reorder(db, color)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# Admin pausiert eine aktive Konfiguration
@router.patch("/{color}/pause", response_model=ReorderConfigResponse, dependencies=[Depends(verify_admin_key)])
async def pause(color: str, db: Session = Depends(get_db)):
    try:
        return await pause_reorder(db, color)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Admin nimmt eine pausierte Konfiguration wieder auf
@router.patch("/{color}/resume", response_model=ReorderConfigResponse, dependencies=[Depends(verify_admin_key)])
async def resume(color: str, db: Session = Depends(get_db)):
    try:
        return await resume_reorder(db, color)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Admin beendet den Dauerauftrag endgültig
@router.patch("/{color}/terminate", response_model=ReorderConfigResponse, dependencies=[Depends(verify_admin_key)])
async def terminate(color: str, db: Session = Depends(get_db)):
    try:
        return await terminate_reorder(db, color)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))