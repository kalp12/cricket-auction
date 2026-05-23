import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from auth.auth import get_current_user
from models.models import Registration, Player, Auction
from email_util import send_registration_confirmation, send_approval_notification, send_rejection_notification

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class RegistrationCreate(BaseModel):
    name: str
    role: str
    country: str
    base_price: float
    image_url: Optional[str] = None
    email: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    batting_avg: Optional[float] = 0.0
    batting_sr: Optional[float] = 0.0
    bowling_avg: Optional[float] = 0.0
    bowling_econ: Optional[float] = 0.0


# ── Public: Upload image for registration (no auth) ──
@router.post("/{auction_id}/upload-image")
async def upload_registration_image(auction_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")
    if not auction.registration_open:
        raise HTTPException(403, "Registration is closed for this auction")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed. Use: {', '.join(IMAGE_EXTENSIONS)}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max 10MB.")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}"}


# ── Public: Submit registration (no auth) ──────────────
@router.post("/{auction_id}/submit")
async def submit_registration(
    auction_id: int,
    data: RegistrationCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")
    if not auction.registration_open:
        raise HTTPException(403, "Registration is closed for this auction")

    # Check deadline if set
    if auction.registration_deadline:
        from datetime import datetime
        if datetime.utcnow() > auction.registration_deadline:
            raise HTTPException(403, "Registration deadline has passed")

    reg = Registration(
        auction_id=auction_id,
        name=data.name,
        role=data.role,
        country=data.country,
        base_price=data.base_price,
        image_url=data.image_url,
        email=data.email,
        matches=data.matches or 0,
        runs=data.runs or 0,
        wickets=data.wickets or 0,
        batting_avg=data.batting_avg or 0.0,
        batting_sr=data.batting_sr or 0.0,
        bowling_avg=data.bowling_avg or 0.0,
        bowling_econ=data.bowling_econ or 0.0,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    # Send confirmation email in background
    if data.email:
        background_tasks.add_task(
            send_registration_confirmation,
            data.email, data.name, auction.name,
        )

    return {"id": reg.id, "message": "Registration submitted successfully"}


# ── Public: Check if registration is open ──────────────
@router.get("/{auction_id}/status")
async def registration_status(auction_id: int, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")

    deadline_passed = False
    if auction.registration_deadline:
        from datetime import datetime
        deadline_passed = datetime.utcnow() > auction.registration_deadline

    return {
        "open": bool(auction.registration_open) and not deadline_passed,
        "auction_name": auction.name,
        "deadline": auction.registration_deadline.isoformat() if auction.registration_deadline else None,
        "form_config": auction.registration_form_config or {
            "name": {"visible": True, "required": True},
            "role": {"visible": True, "required": True},
            "country": {"visible": True, "required": True},
            "base_price": {"visible": True, "required": True},
            "image": {"visible": True, "required": False},
            "email": {"visible": True, "required": False},
            "matches": {"visible": True, "required": False},
            "runs": {"visible": True, "required": False},
            "wickets": {"visible": True, "required": False},
            "batting_avg": {"visible": True, "required": False},
            "batting_sr": {"visible": True, "required": False},
            "bowling_avg": {"visible": True, "required": False},
            "bowling_econ": {"visible": True, "required": False},
        },
    }


# ── Admin: List registrations ──────────────────────────
@router.get("/{auction_id}/list")
async def list_registrations(
    auction_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Registration).filter(Registration.auction_id == auction_id)
    if status:
        query = query.filter(Registration.status == status)
    regs = query.order_by(Registration.created_at.desc()).all()
    return [{
        "id": r.id,
        "name": r.name,
        "role": r.role,
        "country": r.country,
        "base_price": r.base_price,
        "image_url": r.image_url,
        "email": r.email,
        "matches": r.matches,
        "runs": r.runs,
        "wickets": r.wickets,
        "batting_avg": r.batting_avg,
        "batting_sr": r.batting_sr,
        "bowling_avg": r.bowling_avg,
        "bowling_econ": r.bowling_econ,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in regs]


# ── Admin: Approve registration → create Player ───────
@router.post("/{registration_id}/approve")
async def approve_registration(
    registration_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.status != "pending":
        raise HTTPException(400, f"Registration already {reg.status}")

    # Get auction name for email
    auction = db.query(Auction).filter(Auction.id == reg.auction_id).first()
    auction_name = auction.name if auction else "the auction"

    player = Player(
        auction_id=reg.auction_id,
        name=reg.name,
        role=reg.role,
        country=reg.country,
        base_price=reg.base_price,
        image_url=reg.image_url,
        status="pending",
        matches=reg.matches,
        runs=reg.runs,
        wickets=reg.wickets,
        batting_avg=reg.batting_avg,
        batting_sr=reg.batting_sr,
        bowling_avg=reg.bowling_avg,
        bowling_econ=reg.bowling_econ,
    )
    db.add(player)
    reg.status = "approved"
    db.commit()
    db.refresh(player)

    # Send approval email in background
    if reg.email:
        background_tasks.add_task(
            send_approval_notification,
            reg.email, reg.name, auction_name,
        )

    return {"message": "Registration approved", "player_id": player.id}


# ── Admin: Reject registration ─────────────────────────
@router.post("/{registration_id}/reject")
async def reject_registration(
    registration_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.status != "pending":
        raise HTTPException(400, f"Registration already {reg.status}")

    # Get auction name for email
    auction = db.query(Auction).filter(Auction.id == reg.auction_id).first()
    auction_name = auction.name if auction else "the auction"

    reg.status = "rejected"
    db.commit()

    # Send rejection email in background
    if reg.email:
        background_tasks.add_task(
            send_rejection_notification,
            reg.email, reg.name, auction_name,
        )

    return {"message": "Registration rejected"}


# ── Admin: Toggle registration open/close ──────────────
@router.post("/{auction_id}/toggle")
async def toggle_registration(auction_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")
    auction.registration_open = 0 if auction.registration_open else 1
    db.commit()
    return {"registration_open": bool(auction.registration_open)}


# ── Admin: Set registration deadline ───────────────────
@router.put("/{auction_id}/deadline")
async def set_registration_deadline(
    auction_id: int,
    deadline: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")

    if deadline:
        from datetime import datetime
        try:
            auction.registration_deadline = datetime.fromisoformat(deadline)
        except ValueError:
            raise HTTPException(400, "Invalid deadline format. Use ISO 8601 (e.g. 2025-12-31T23:59:59)")
    else:
        auction.registration_deadline = None

    db.commit()
    return {
        "registration_deadline": auction.registration_deadline.isoformat() if auction.registration_deadline else None,
    }


# ── Admin: Update registration form config ─────────────
@router.put("/{auction_id}/form-config")
async def update_form_config(
    auction_id: int,
    config: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")

    import json
    auction.registration_form_config = json.dumps(config)
    db.commit()
    return {"form_config": config}
