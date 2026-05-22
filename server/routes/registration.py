from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from auth.auth import get_current_user
from models.models import Registration, Player, Auction

router = APIRouter()


class RegistrationCreate(BaseModel):
    name: str
    role: str
    country: str
    base_price: float
    image_url: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    batting_avg: Optional[float] = 0.0
    batting_sr: Optional[float] = 0.0
    bowling_avg: Optional[float] = 0.0
    bowling_econ: Optional[float] = 0.0


# ── Public: Submit registration (no auth) ──────────────
@router.post("/{auction_id}/submit")
async def submit_registration(auction_id: int, data: RegistrationCreate, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")
    if not auction.registration_open:
        raise HTTPException(403, "Registration is closed for this auction")

    reg = Registration(
        auction_id=auction_id,
        name=data.name,
        role=data.role,
        country=data.country,
        base_price=data.base_price,
        image_url=data.image_url,
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
    return {"id": reg.id, "message": "Registration submitted successfully"}


# ── Public: Check if registration is open ──────────────
@router.get("/{auction_id}/status")
async def registration_status(auction_id: int, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Auction not found")
    return {"open": bool(auction.registration_open), "auction_name": auction.name}


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
async def approve_registration(registration_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.status != "pending":
        raise HTTPException(400, f"Registration already {reg.status}")

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
    return {"message": "Registration approved", "player_id": player.id}


# ── Admin: Reject registration ─────────────────────────
@router.post("/{registration_id}/reject")
async def reject_registration(registration_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.status != "pending":
        raise HTTPException(400, f"Registration already {reg.status}")

    reg.status = "rejected"
    db.commit()
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
