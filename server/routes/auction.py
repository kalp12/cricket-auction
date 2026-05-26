from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from db.database import get_db
from auth.auth import get_current_user
from models.models import Auction, Bid, Player, Team, TeamPlayer
from schemas.auction import BidCreate, AuctionResponse, AuctionStateResponse
from routes.bids import manager as ws_manager
from event_recorder import record_event
import json

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

    auction = db.query(Auction).filter(Auction.id == player.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    auction.current_player_id = player_id
    auction.current_bid = player.base_price
    auction.status = "live"
    auction.timer_seconds = timer_seconds

    db.commit()
    db.refresh(auction)

    record_event(auction.id, "start", {
        "player_id": player.id, "player_name": player.name,
        "base_price": player.base_price, "timer_seconds": timer_seconds,
    }, db)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=player.name,
        current_bid=auction.current_bid,
        current_team_id=None,
        current_team_name=None,
        timer_seconds=auction.timer_seconds,
        timer_mode=auction.timer_mode,
    )


@router.post("/bid")
async def place_bid(
    bid_data: BidCreate,
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.status != "live":
        raise HTTPException(status_code=400, detail="Auction is not live")

    if bid_data.amount <= auction.current_bid:
        raise HTTPException(status_code=400, detail="Bid must be higher than current bid")

    team = db.query(Team).filter(Team.id == bid_data.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

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
        timer_seconds=auction.timer_seconds,
        timer_mode=auction.timer_mode,
    )


@router.post("/sold")
async def mark_sold(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.status != "live":
        raise HTTPException(status_code=400, detail=f"Auction is not live (status={auction.status})")

    if not auction.current_team_id:
        raise HTTPException(status_code=400, detail="No bids placed yet")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    winning_team = db.query(Team).filter(Team.id == auction.current_team_id).first()
    sold_price = auction.current_bid

    # RTM check: if enabled and player has a previous team that isn't the winning team
    if auction.rtm_enabled and player.previous_team_id and player.previous_team_id != winning_team.id:
        prev_team = db.query(Team).filter(Team.id == player.previous_team_id).first()
        if prev_team and prev_team.remaining_budget >= sold_price and prev_team.auction_id == auction.id:
            # Pause auction and broadcast RTM prompt
            auction.status = "rtm_pending"
            db.commit()

            record_event(auction.id, "rtm_prompt", {
                "player_id": player.id, "player_name": player.name,
                "previous_team_id": prev_team.id, "previous_team_name": prev_team.name,
                "winning_team_id": winning_team.id, "winning_team_name": winning_team.name,
                "price": sold_price,
            }, db)

            await ws_manager.broadcast(auction.id, {
                "type": "rtm_prompt",
                "player_name": player.name,
                "player_id": player.id,
                "winning_team_name": winning_team.name,
                "winning_team_short": winning_team.short_name,
                "winning_team_id": winning_team.id,
                "rtm_team_name": prev_team.name,
                "rtm_team_short": prev_team.short_name,
                "rtm_team_id": prev_team.id,
                "price": sold_price,
                "status": "rtm_pending",
            })

            return {
                "message": "RTM prompt sent",
                "rtm_pending": True,
                "player": player.name,
                "winning_team": winning_team.name,
                "rtm_team": prev_team.name,
                "price": sold_price,
                "status": "rtm_pending",
            }

    # No RTM — complete the sale directly
    return await _complete_sale(auction, player, winning_team, sold_price, db)


async def _complete_sale(auction, player, winning_team, sold_price, db):
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
            auction.status = "live"
        else:
            auction.status = "ended"
            auction.current_player_id = None
            auction.current_bid = 0
            auction.current_team_id = None

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    db.refresh(auction)
    db.refresh(winning_team)
    next_player_name = None
    if auction.current_player_id:
        np = db.query(Player).filter(Player.id == auction.current_player_id).first()
        next_player_name = np.name if np else None

    await ws_manager.broadcast(auction.id, {
        "type": "sold",
        "player_name": player.name,
        "player_id": player.id,
        "team_name": winning_team.name,
        "team_short": winning_team.short_name,
        "team_id": winning_team.id,
        "price": sold_price,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
        "status": auction.status,
        "play_sound": "gavel",
    })

    record_event(auction.id, "sold", {
        "player_id": player.id, "player_name": player.name,
        "team_id": winning_team.id, "team_name": winning_team.name,
        "price": sold_price,
    }, db)

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


@router.post("/rtm-accept")
async def rtm_accept(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "rtm_pending").first()

    if not auction or auction.status != "rtm_pending":
        raise HTTPException(status_code=400, detail="No RTM pending")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player or not player.previous_team_id:
        raise HTTPException(status_code=400, detail="Player has no previous team")

    rtm_team = db.query(Team).filter(Team.id == player.previous_team_id).first()
    if not rtm_team:
        raise HTTPException(status_code=404, detail="Previous team not found")

    sold_price = auction.current_bid
    if rtm_team.remaining_budget < sold_price:
        raise HTTPException(status_code=400, detail="Previous team has insufficient budget for RTM")

    player.rtm_used = 1
    result = await _complete_sale(auction, player, rtm_team, sold_price, db)

    record_event(auction.id, "rtm_accept", {
        "player_id": player.id, "player_name": player.name,
        "team_id": rtm_team.id, "team_name": rtm_team.name,
        "price": sold_price,
    }, db)

    await ws_manager.broadcast(auction.id, {
        "type": "rtm_result",
        "rtm_accepted": True,
        "player_name": player.name,
        "player_id": player.id,
        "team_name": rtm_team.name,
        "team_short": rtm_team.short_name,
        "team_id": rtm_team.id,
        "price": sold_price,
        "status": result.get("status", "live"),
    })

    return result


@router.post("/rtm-decline")
async def rtm_decline(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "rtm_pending").first()

    if not auction or auction.status != "rtm_pending":
        raise HTTPException(status_code=400, detail="No RTM pending")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    winning_team = db.query(Team).filter(Team.id == auction.current_team_id).first()
    if not winning_team:
        raise HTTPException(status_code=400, detail="No winning bid found")

    sold_price = auction.current_bid
    player.rtm_used = 2
    result = await _complete_sale(auction, player, winning_team, sold_price, db)

    record_event(auction.id, "rtm_decline", {
        "player_id": player.id, "player_name": player.name,
        "winning_team_id": winning_team.id, "winning_team_name": winning_team.name,
        "rtm_team_id": player.previous_team_id,
        "price": sold_price,
    }, db)

    await ws_manager.broadcast(auction.id, {
        "type": "rtm_result",
        "rtm_accepted": False,
        "player_name": player.name,
        "player_id": player.id,
        "team_name": winning_team.name,
        "team_short": winning_team.short_name,
        "team_id": winning_team.id,
        "price": sold_price,
        "status": result.get("status", "live"),
    })

    return result


@router.post("/unsold")
async def mark_unsold(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.status != "live":
        raise HTTPException(status_code=400, detail=f"Auction is not live (status={auction.status})")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.status = "unsold"

    # Auto-advance to next unsold player (skip the current one)
    next_p = db.query(Player).filter(
        Player.auction_id == auction.id,
        Player.status == "unsold",
        Player.id != player.id
    ).order_by(Player.id).first()

    if next_p:
        auction.current_player_id = next_p.id
        auction.current_bid = next_p.base_price
        auction.current_team_id = None
    else:
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
        "player_id": player.id,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
        "status": auction.status,
        "play_sound": "unsold",
    })

    record_event(auction.id, "unsold", {
        "player_id": player.id, "player_name": player.name,
    }, db)

    return {
        "message": "Player marked as unsold",
        "status": auction.status,
        "current_player_id": auction.current_player_id,
        "current_player_name": next_player_name,
        "current_bid": auction.current_bid,
    }


@router.post("/pause")
async def pause_auction(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction or auction.status != "live":
        raise HTTPException(status_code=400, detail="No live auction")

    auction.status = "paused"
    db.commit()
    db.refresh(auction)

    await ws_manager.broadcast(auction.id, {
        "type": "state",
        "auction_id": auction.id,
        "status": auction.status,
        "current_bid": auction.current_bid,
        "current_player_id": auction.current_player_id,
        "current_team_id": auction.current_team_id,
        "timer_seconds": auction.timer_seconds,
    })

    record_event(auction.id, "pause", {"status": "paused"}, db)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=auction.current_player.name if auction.current_player_id else None,
        current_bid=auction.current_bid,
        current_team_id=auction.current_team_id,
        current_team_name=auction.current_team.name if auction.current_team_id else None,
        timer_seconds=auction.timer_seconds,
        timer_mode=auction.timer_mode,
    )


@router.post("/resume")
async def resume_auction(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "paused").first()

    if not auction or auction.status != "paused":
        raise HTTPException(status_code=400, detail="No paused auction")

    auction.status = "live"
    db.commit()
    db.refresh(auction)

    await ws_manager.broadcast(auction.id, {
        "type": "state",
        "auction_id": auction.id,
        "status": auction.status,
        "current_bid": auction.current_bid,
        "current_player_id": auction.current_player_id,
        "current_team_id": auction.current_team_id,
        "timer_seconds": auction.timer_seconds,
    })

    record_event(auction.id, "resume", {"status": "live"}, db)

    return AuctionResponse(
        id=auction.id,
        status=auction.status,
        current_player_id=auction.current_player_id,
        current_player_name=auction.current_player.name if auction.current_player_id else None,
        current_bid=auction.current_bid,
        current_team_id=auction.current_team_id,
        current_team_name=auction.current_team.name if auction.current_team_id else None,
        timer_seconds=auction.timer_seconds,
        timer_mode=auction.timer_mode,
    )


@router.post("/play-sound")
async def trigger_sound(
    sound_key: str = Query(..., description="Sound key: gavel, unsold, timer, celebration"),
    auction_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    await ws_manager.broadcast(auction.id, {
        "type": "play_sound",
        "sound_key": sound_key,
    })

    return {"message": f"Sound '{sound_key}' triggered"}


@router.get("/state", response_model=AuctionStateResponse)
async def get_auction_state(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
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
            "timer_mode": auction.timer_mode,
            "sold_count": sold_count,
            "unsold_count": unsold_count
        },
        current_player=current_player,
        highest_bid=highest_bid,
        bids_history=bids_history,
        all_teams=teams_list
    )


@router.get("/history")
async def get_auction_history(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    if auction_id:
        team_players = db.query(TeamPlayer).join(Team).filter(Team.auction_id == auction_id).all()
    else:
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
