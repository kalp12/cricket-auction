import json
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
from models.models import AuctionEvent, Auction
from auth.auth import get_current_user
from schemas.auth import UserResponse
from pydantic import BaseModel


router = APIRouter()


class EventResponse(BaseModel):
    id: int
    auction_id: int
    event_type: str
    data: dict
    snapshot: Optional[dict] = None
    timestamp: str

    class Config:
        from_attributes = True


@router.get("/{auction_id}/events", response_model=List[EventResponse])
def get_events(
    auction_id: int,
    after_event_id: int = Query(0),
    limit: int = Query(500),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get auction events for replay, ordered by timestamp."""
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    query = db.query(AuctionEvent).filter(
        AuctionEvent.auction_id == auction_id,
        AuctionEvent.id > after_event_id,
    ).order_by(AuctionEvent.id.asc())

    events = query.limit(limit).all()
    result = []
    for e in events:
        result.append(EventResponse(
            id=e.id,
            auction_id=e.auction_id,
            event_type=e.event_type,
            data=json.loads(e.data) if e.data else {},
            snapshot=json.loads(e.snapshot) if e.snapshot else None,
            timestamp=e.timestamp.isoformat() if e.timestamp else "",
        ))
    return result


@router.get("/{auction_id}/replay", response_model=List[EventResponse])
def get_replay(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get all auction events with snapshots for the replay player."""
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    events = db.query(AuctionEvent).filter(
        AuctionEvent.auction_id == auction_id,
    ).order_by(AuctionEvent.id.asc()).all()

    result = []
    for e in events:
        result.append(EventResponse(
            id=e.id,
            auction_id=e.auction_id,
            event_type=e.event_type,
            data=json.loads(e.data) if e.data else {},
            snapshot=json.loads(e.snapshot) if e.snapshot else None,
            timestamp=e.timestamp.isoformat() if e.timestamp else "",
        ))
    return result
