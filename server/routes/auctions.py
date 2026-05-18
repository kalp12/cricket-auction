from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.models import Auction, Player
from schemas.auctions import AuctionSchema, AuctionCreate, AuctionUpdate
from auth.auth import get_current_user

router = APIRouter()


@router.post("", response_model=AuctionSchema, status_code=status.HTTP_201_CREATED)
def create_auction(auction: AuctionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Create a new auction (admin only)"""
    db_auction = Auction(
        name=auction.name,
        status="waiting",
        timer_seconds=auction.timer_seconds,
        timer_enabled=auction.timer_enabled,
        base_bid=auction.base_bid,
        budget_per_team=auction.budget_per_team,
        min_players=auction.min_players,
        max_players=auction.max_players,
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
def update_auction(auction_id: int, auction_update: AuctionUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def delete_auction(auction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Delete an auction"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    db.delete(db_auction)
    db.commit()
    return {"message": "Auction deleted successfully"}


@router.post("/{auction_id}/start", status_code=status.HTTP_200_OK)
def start_auction(auction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Start an auction (admin only)"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    if db_auction.status != "waiting":
        raise HTTPException(status_code=400, detail="Auction already started or ended")

    db_auction.status = "live"
    db.commit()
    return {"message": "Auction started successfully"}


@router.post("/{auction_id}/next-player", status_code=status.HTTP_200_OK)
def next_player(auction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Move to next player in auction (admin only)"""
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not db_auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    if db_auction.status != "live":
        raise HTTPException(status_code=400, detail="Auction not in progress")

    next_player = db.query(Player).filter(
        Player.status == "unsold"
    ).first()

    if not next_player:
        db_auction.status = "ended"
        db.commit()
        return {"message": "No more players. Auction ended."}

    db_auction.current_player_id = next_player.id
    db_auction.current_bid = next_player.base_price
    db_auction.current_team_id = None
    db.commit()

    return {"message": "Next player set successfully"}
