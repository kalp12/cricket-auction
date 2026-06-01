import random
from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db.database import get_db
from models.models import Auction, Player, Team
from schemas.auctions import AuctionSchema, AuctionCreate, AuctionUpdate
from auth.auth import get_current_user, require_role
from schemas.auth import UserResponse
from routes.bids import manager as ws_manager
from event_recorder import record_event

router = APIRouter()


@router.post("", response_model=AuctionSchema, status_code=status.HTTP_201_CREATED)
def create_auction(auction: AuctionCreate, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Create a new auction (admin only)"""
    db_auction = Auction(
        name=auction.name,
        status="waiting",
        auction_type=auction.auction_type,
        timer_seconds=auction.timer_seconds,
        timer_mode=auction.timer_mode,
        base_bid=auction.base_bid,
        budget_per_team=auction.budget_per_team,
        min_players=auction.min_players,
        max_players=auction.max_players,
        image_url=auction.image_url,
        dutch_start_price=auction.dutch_start_price,
        dutch_decrement=auction.dutch_decrement,
        dutch_interval=auction.dutch_interval,
    )
    db.add(db_auction)
    db.commit()
    db.refresh(db_auction)
    return db_auction


@router.get("", response_model=List[AuctionSchema])
def list_auctions(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """List all auctions"""
    return db.query(Auction).order_by(Auction.id.desc()).all()


@router.get("/{auction_id}", response_model=AuctionSchema)
def get_auction(auction_id: int, db: Session = Depends(get_db)):
    """Get auction details by ID"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return db_auction


@router.put("/{auction_id}", response_model=AuctionSchema)
def update_auction(auction_id: int, auction_update: AuctionUpdate, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Update auction settings"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    update_data = auction_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_auction, key, value)
    db.commit()
    db.refresh(db_auction)
    return db_auction


@router.delete("/{auction_id}")
def delete_auction(auction_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Delete an auction"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    db.delete(db_auction)
    db.commit()
    return {"message": "Auction deleted successfully"}


@router.post("/{auction_id}/start", status_code=status.HTTP_200_OK)
async def start_auction(auction_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Start an auction (admin only). Clears current player — use next-player to pick one."""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    if db_auction.status != "waiting":
        raise HTTPException(status_code=400, detail="Auction already started or ended")

    db_auction.status = "live"
    db_auction.current_player_id = None
    db_auction.current_bid = 0
    db_auction.current_team_id = None
    db.commit()

    await ws_manager.broadcast(auction_id, {
        "type": "state",
        "auction_id": auction_id,
        "status": "live",
        "current_bid": 0,
        "current_player_id": None,
        "current_team_id": None,
        "current_player": None,
        "timer_seconds": db_auction.timer_seconds,
        "timer_mode": db_auction.timer_mode,
    })

    return {"message": "Auction started successfully"}


@router.post("/{auction_id}/next-player", status_code=status.HTTP_200_OK)
async def next_player(auction_id: int, random_select: bool = Query(True), player_id: int = Query(None), db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Move to next player. Default: random. Use player_id to pick a specific player."""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    if db_auction.status not in ("live", "waiting"):
        raise HTTPException(status_code=400, detail="Auction not in progress")

    # If specific player requested, select them directly
    if player_id:
        next_p = db.query(Player).filter(Player.id == player_id, Player.auction_id == auction_id, Player.status == "unsold").first()
        if not next_p:
            raise HTTPException(status_code=404, detail="Player not found or already sold")
    else:
        # If there's a current player still unsold, skip it
        exclude_id = None
        if db_auction.current_player_id:
            current = db.query(Player).filter(Player.id == db_auction.current_player_id).first()
            if current and current.status == "unsold":
                exclude_id = current.id

        # Only select players with status "unsold" (excludes "sold" and "passed")
        query = db.query(Player).filter(
            Player.auction_id == auction_id,
            Player.status == "unsold"
        )
        if exclude_id:
            query = query.filter(Player.id != exclude_id)

        candidates = query.all()

        if not candidates:
            db_auction.status = "ended"
            db.commit()
            await ws_manager.broadcast(auction_id, {
                "type": "state",
                "auction_id": auction_id,
                "status": "ended",
                "current_bid": 0,
                "current_player_id": None,
                "current_team_id": None,
                "timer_seconds": 0,
                "current_player": None,
                "current_team": None,
            })
            record_event(auction_id, "end", {"status": "ended", "reason": "no_more_players"}, db)
            return {"message": "No more players. Auction ended."}

        # Pick random or sequential
        if random_select:
            next_p = random.choice(candidates)
        else:
            next_p = candidates[0]

    db_auction.current_player_id = next_p.id
    db_auction.current_bid = next_p.base_price
    db_auction.current_team_id = None
    db_auction.status = "live"
    db.commit()

    # Broadcast to all connected WebSocket clients
    player_data = {
        "id": next_p.id,
        "name": next_p.name,
        "role": next_p.role,
        "country": next_p.country,
        "base_price": next_p.base_price,
        "image_url": next_p.image_url,
        "matches": next_p.matches,
        "runs": next_p.runs,
        "wickets": next_p.wickets,
        "batting_avg": next_p.batting_avg,
        "batting_sr": next_p.batting_sr,
        "bowling_avg": next_p.bowling_avg,
        "bowling_econ": next_p.bowling_econ,
    }

    await ws_manager.broadcast(auction_id, {
        "type": "next_player",
        "auction_id": auction_id,
        "status": "live",
        "current_bid": next_p.base_price,
        "current_player_id": next_p.id,
        "current_team_id": None,
        "timer_seconds": db_auction.timer_seconds,
        "timer_mode": db_auction.timer_mode,
        "current_player": player_data,
        "current_team": None,
    })

    record_event(auction_id, "next_player", {
        "player_id": next_p.id, "player_name": next_p.name,
        "base_price": next_p.base_price,
    }, db)

    return {
        "message": "Next player set successfully",
        "player_id": next_p.id,
        "player_name": next_p.name,
        "base_price": next_p.base_price,
    }


@router.post("/{auction_id}/reauction", status_code=status.HTTP_200_OK)
async def reauction_passed_players(auction_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Reset all 'passed' players back to 'unsold' so they can be re-auctioned."""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    passed = db.query(Player).filter(
        Player.auction_id == auction_id,
        Player.status == "passed",
    ).all()

    if not passed:
        raise HTTPException(status_code=400, detail="No passed players to re-auction")

    for p in passed:
        p.status = "unsold"

    # If auction was ended but now has players again, set back to live
    if db_auction.status == "ended":
        db_auction.status = "live"

    db.commit()

    await ws_manager.broadcast(auction_id, {
        "type": "state",
        "auction_id": auction_id,
        "status": db_auction.status,
        "current_bid": db_auction.current_bid,
        "current_player_id": db_auction.current_player_id,
        "current_team_id": db_auction.current_team_id,
        "timer_seconds": db_auction.timer_seconds,
        "timer_mode": db_auction.timer_mode,
        "current_player": None,
        "current_team": None,
    })

    record_event(auction_id, "reauction", {
        "reset_count": len(passed),
        "player_ids": [p.id for p in passed],
    }, db)

    return {"message": f"{len(passed)} players reset to unsold for re-auction", "count": len(passed)}
