from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from db.database import get_db
from auth.auth import get_current_user
from models.models import Auction, Bid, Player, Team, TeamPlayer
from schemas.auction import BidCreate, AuctionResponse, AuctionStateResponse
from routes.bids import manager as ws_manager

router = APIRouter(tags=["auction"])


@router.post("/start")
async def start_auction(
    player_id: int,
    timer_seconds: int = 60,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if player.status != "unsold":
        raise HTTPException(status_code=400, detail="Player is not available for auction")

    live_auction = db.query(Auction).filter(Auction.status == "live").first()
    if live_auction:
        raise HTTPException(status_code=400, detail="Another auction is already live")

    auction = db.query(Auction).filter(Auction.id == player.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    auction.status = "waiting"
    auction.current_player_id = None
    auction.current_bid = 0
    auction.current_team_id = None
    auction.timer_seconds = timer_seconds

    auction.current_player_id = player_id
    auction.current_bid = player.base_price
    auction.status = "live"
    auction.timer_seconds = timer_seconds

    db.commit()
    db.refresh(auction)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=player.name,
        current_bid=auction.current_bid,
        current_team_id=None,
        current_team_name=None,
        timer_seconds=auction.timer_seconds
    )


@router.post("/bid")
async def place_bid(
    bid_data: BidCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.status == "live").first()
    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")

    if bid_data.amount <= auction.current_bid:
        raise HTTPException(status_code=400, detail="Bid must be higher than current bid")

    team = db.query(Team).filter(Team.id == bid_data.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify team belongs to this auction
    if team.auction_id != auction.id:
        raise HTTPException(status_code=400, detail="Team does not belong to this auction")

    if team.remaining_budget < bid_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient budget")

    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).count()
    if team_players >= team.max_players:
        raise HTTPException(status_code=400, detail="Team has reached max players")

    if auction.current_team_id == team.id:
        raise HTTPException(status_code=400, detail="Cannot place consecutive bids on same player")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Current player not found")

    bid = Bid(
        auction_id=auction.id,
        team_id=team.id,
        player_id=player.id,
        amount=bid_data.amount,
        timestamp=datetime.utcnow()
    )
    db.add(bid)

    auction.current_bid = bid_data.amount
    auction.current_team_id = team.id

    db.commit()
    db.refresh(auction)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=player.name,
        current_bid=auction.current_bid,
        current_team_id=auction.current_team_id,
        current_team_name=team.name,
        timer_seconds=auction.timer_seconds
    )


@router.post("/sold")
async def mark_sold(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.status == "live").first()
    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")

    if not auction.current_team_id:
        raise HTTPException(status_code=400, detail="No bids placed yet")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    winning_team = db.query(Team).filter(Team.id == auction.current_team_id).first()
    sold_price = auction.current_bid

    try:
        player.status = "sold"

        team_player = TeamPlayer(
            team_id=winning_team.id,
            player_id=player.id,
            bought_price=sold_price
        )
        db.add(team_player)

        winning_team.remaining_budget -= sold_price

        # Auto-advance to next unsold player
        next_p = db.query(Player).filter(
            Player.auction_id == auction.id,
            Player.status == "unsold"
        ).order_by(Player.id).first()

        if next_p:
            auction.current_player_id = next_p.id
            auction.current_bid = next_p.base_price
            auction.current_team_id = None
            # Keep auction live
        else:
            # No more players — end the auction
            auction.status = "ended"
            auction.current_player_id = None
            auction.current_bid = 0
            auction.current_team_id = None

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    db.refresh(auction)
    next_player_name = None
    if auction.current_player_id:
        np = db.query(Player).filter(Player.id == auction.current_player_id).first()
        next_player_name = np.name if np else None

    await ws_manager.broadcast(auction.id, {
        "type": "sold",
        "player_name": player.name,
        "team_name": winning_team.name,
        "price": sold_price,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
        "status": auction.status,
    })

    return {
        "message": "Player sold",
        "player": player.name,
        "team": winning_team.name,
        "price": sold_price,
        "status": auction.status,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
    }


@router.post("/unsold")
async def mark_unsold(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.status == "live").first()
    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.status = "unsold"

    # Auto-advance to next unsold player (skip the current one since it's still unsold)
    next_p = db.query(Player).filter(
        Player.auction_id == auction.id,
        Player.status == "unsold",
        Player.id != player.id
    ).order_by(Player.id).first()

    if next_p:
        auction.current_player_id = next_p.id
        auction.current_bid = next_p.base_price
        auction.current_team_id = None
        # Keep auction live
    else:
        # No more unsold players
        auction.status = "ended"
        auction.current_player_id = None
        auction.current_bid = 0
        auction.current_team_id = None

    db.commit()

    db.refresh(auction)
    next_player_name = None
    if auction.current_player_id:
        np = db.query(Player).filter(Player.id == auction.current_player_id).first()
        next_player_name = np.name if np else None

    await ws_manager.broadcast(auction.id, {
        "type": "unsold",
        "player_name": player.name,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
        "status": auction.status,
    })

    return {
        "message": "Player marked as unsold",
        "status": auction.status,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
    }


@router.post("/pause")
async def pause_auction(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.status == "live").first()
    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")

    auction.status = "paused"
    db.commit()
    db.refresh(auction)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=auction.current_player.name if auction.current_player_id else None,
        current_bid=auction.current_bid,
        current_team_id=auction.current_team_id,
        current_team_name=auction.current_team.name if auction.current_team_id else None,
        timer_seconds=auction.timer_seconds
    )


@router.post("/resume")
async def resume_auction(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.status == "paused").first()
    if not auction:
        raise HTTPException(status_code=400, detail="No paused auction")

    auction.status = "live"
    db.commit()
    db.refresh(auction)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=auction.current_player.name if auction.current_player_id else None,
        current_bid=auction.current_bid,
        current_team_id=auction.current_team_id,
        current_team_name=auction.current_team.name if auction.current_team_id else None,
        timer_seconds=auction.timer_seconds
    )


@router.get("/state", response_model=AuctionStateResponse)
async def get_auction_state(db: Session = Depends(get_db)):
    auction = db.query(Auction).first()
    if not auction:
        raise HTTPException(status_code=404, detail="No auction exists")

    current_player = None
    if auction.current_player_id:
        player = db.query(Player).filter(Player.id == auction.current_player_id).first()
        if player:
            current_player = {
                "id": player.id,
                "name": player.name,
                "role": player.role,
                "country": player.country,
                "base_price": player.base_price,
                "status": player.status,
                "image_url": player.image_url
            }

    highest_bid = None
    if auction.current_bid > 0:
        highest_bid = {
            "team_id": auction.current_team_id,
            "amount": auction.current_bid
        }

    bids = db.query(Bid).filter(Bid.auction_id == auction.id)\
        .order_by(Bid.timestamp.desc()).limit(10).all()
    bids_history = []
    for bid in bids:
        team = db.query(Team).filter(Team.id == bid.team_id).first()
        bids_history.append({
            "id": bid.id,
            "auction_id": bid.auction_id,
            "team_id": bid.team_id,
            "team_name": team.name if team else None,
            "player_id": bid.player_id,
            "amount": bid.amount,
            "timestamp": bid.timestamp
        })

    teams = db.query(Team).filter(Team.auction_id == auction.id).all()
    teams_list = []
    for team in teams:
        teams_list.append({
            "id": team.id,
            "name": team.name,
            "short_name": team.short_name,
            "remaining_budget": team.remaining_budget
        })

    # Count players by status for this auction
    sold_count = db.query(Player).filter(Player.auction_id == auction.id, Player.status == "sold").count()
    unsold_count = db.query(Player).filter(Player.auction_id == auction.id, Player.status == "unsold").count()

    return AuctionStateResponse(
        current_auction={
            "id": auction.id,
            "name": auction.name,
            "status": auction.status,
            "current_player_id": auction.current_player_id,
            "current_bid": auction.current_bid,
            "current_team_id": auction.current_team_id,
            "timer_seconds": auction.timer_seconds,
            "sold_count": sold_count,
            "unsold_count": unsold_count
        },
        current_player=current_player,
        highest_bid=highest_bid,
        bids_history=bids_history,
        all_teams=teams_list
    )


@router.get("/history")
async def get_auction_history(db: Session = Depends(get_db)):
    team_players = db.query(TeamPlayer).all()
    history = []
    for tp in team_players:
        player = db.query(Player).filter(Player.id == tp.player_id).first()
        team = db.query(Team).filter(Team.id == tp.team_id).first()
        if player and team:
            history.append({
                "player": player.name,
                "team": team.name,
                "price": tp.bought_price,
                "timestamp": tp.id
            })

    return history
