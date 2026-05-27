from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
import asyncio
import json

from db.database import get_db
from auth.auth import get_current_user
from models.models import Auction, Bid, Player, Team, TeamPlayer, ProxyBid
from routes.bids import manager as ws_manager
from event_recorder import record_event

router = APIRouter(tags=["bonus-auction"])


# ── Sealed Bid ────────────────────────────────────────────

@router.post("/sealed-bid")
async def submit_sealed_bid(
    team_id: int = Query(...),
    amount: float = Query(...),
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.auction_type != "sealed":
        raise HTTPException(status_code=400, detail="Not a sealed bid auction")

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.remaining_budget < amount:
        raise HTTPException(status_code=400, detail="Insufficient budget")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="No current player")
    if amount < player.base_price:
        raise HTTPException(status_code=400, detail=f"Bid must be at least base price ({player.base_price})")

    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).count()
    if team_players >= team.max_players:
        raise HTTPException(status_code=400, detail="Team has reached max players")

    # Check if team already submitted a sealed bid for this player
    existing = db.query(Bid).filter(
        Bid.auction_id == auction.id,
        Bid.team_id == team_id,
        Bid.player_id == player.id,
        Bid.is_sealed == 1,
    ).first()
    if existing:
        # Allow updating the sealed bid
        existing.amount = amount
        existing.timestamp = datetime.utcnow()
        db.commit()
        return {"message": "Sealed bid updated", "amount": amount}

    bid = Bid(
        auction_id=auction.id,
        team_id=team_id,
        player_id=player.id,
        amount=amount,
        is_sealed=1,
        timestamp=datetime.utcnow(),
    )
    db.add(bid)
    db.commit()

    # Notify admin that a sealed bid was received (but not the amount)
    await ws_manager.broadcast(auction.id, {
        "type": "sealed_bid_received",
        "team_name": team.name,
        "team_short": team.short_name,
        "team_id": team.id,
    })

    return {"message": "Sealed bid submitted", "amount": amount}


@router.post("/sealed-reveal")
async def reveal_sealed_bids(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.auction_type != "sealed":
        raise HTTPException(status_code=400, detail="Not a sealed bid auction")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="No current player")

    # Get all sealed bids for this player, sorted highest first
    sealed_bids = db.query(Bid).filter(
        Bid.auction_id == auction.id,
        Bid.player_id == player.id,
        Bid.is_sealed == 1,
    ).order_by(Bid.amount.desc()).all()

    if not sealed_bids:
        # No bids — mark unsold
        await ws_manager.broadcast(auction.id, {
            "type": "sealed_reveal",
            "bids": [],
            "winner": None,
            "player_name": player.name,
            "player_id": player.id,
        })
        return {"message": "No sealed bids submitted", "bids": [], "winner": None}

    bids_data = []
    for b in sealed_bids:
        t = db.query(Team).filter(Team.id == b.team_id).first()
        bids_data.append({
            "team_id": b.team_id,
            "team_name": t.name if t else None,
            "team_short": t.short_name if t else None,
            "amount": b.amount,
        })

    winner_bid = sealed_bids[0]
    winner_team = db.query(Team).filter(Team.id == winner_bid.team_id).first()
    sold_price = winner_bid.amount

    auction.status = "sealed_reveal"
    auction.current_bid = sold_price
    auction.current_team_id = winner_team.id
    db.commit()

    # Broadcast all bids (the big reveal!)
    await ws_manager.broadcast(auction.id, {
        "type": "sealed_reveal",
        "bids": bids_data,
        "winner_team_id": winner_team.id,
        "winner_team_name": winner_team.name,
        "winner_team_short": winner_team.short_name,
        "price": sold_price,
        "player_name": player.name,
        "player_id": player.id,
    })

    record_event(auction.id, "sealed_reveal", {
        "player_id": player.id, "player_name": player.name,
        "bids": bids_data,
        "winner_team_id": winner_team.id, "winner_team_name": winner_team.name,
        "price": sold_price,
    }, db)

    return {
        "message": "Sealed bids revealed",
        "bids": bids_data,
        "winner": winner_team.name,
        "price": sold_price,
    }


@router.post("/sealed-confirm")
async def confirm_sealed_sale(
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "sealed_reveal").first()

    if not auction or auction.status != "sealed_reveal":
        raise HTTPException(status_code=400, detail="No sealed reveal pending")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    winning_team = db.query(Team).filter(Team.id == auction.current_team_id).first()
    if not winning_team:
        raise HTTPException(status_code=400, detail="No winning team")

    from routes.auction import _complete_sale
    result = await _complete_sale(auction, player, winning_team, auction.current_bid, db)

    record_event(auction.id, "sealed_confirm", {
        "player_id": player.id, "player_name": player.name,
        "team_id": winning_team.id, "team_name": winning_team.name,
        "price": auction.current_bid,
    }, db)

    return result


# ── Dutch Auction ──────────────────────────────────────────

async def _dutch_price_ticker(auction_id: int, db_session_factory):
    """Background task that decrements Dutch auction price at intervals."""
    await asyncio.sleep(3)  # Initial delay before first drop

    while True:
        db = db_session_factory()
        try:
            auction = db.query(Auction).filter(Auction.id == auction_id).first()
            if not auction or auction.status != "dutch_active":
                break

            new_price = auction.dutch_current_price - auction.dutch_decrement
            player = db.query(Player).filter(Player.id == auction.current_player_id).first()
            base_price = player.base_price if player else 0

            if new_price < base_price:
                # Price hit base — no one accepted, mark unsold
                auction.status = "live"
                auction.dutch_current_price = None
                db.commit()

                await ws_manager.broadcast(auction_id, {
                    "type": "dutch_floor_reached",
                    "price": base_price,
                    "player_name": player.name if player else None,
                    "player_id": auction.current_player_id,
                })
                break

            auction.dutch_current_price = new_price
            db.commit()

            await ws_manager.broadcast(auction_id, {
                "type": "dutch_price_drop",
                "current_price": new_price,
                "decrement": auction.dutch_decrement,
                "player_name": player.name if player else None,
                "player_id": auction.current_player_id,
            })

            record_event(auction_id, "dutch_price_drop", {
                "current_price": new_price, "player_id": auction.current_player_id,
            }, db)
        finally:
            db.close()

        await asyncio.sleep(auction.dutch_interval if auction else 10)


@router.post("/dutch-start")
async def start_dutch_auction(
    auction_id: int = Query(...),
    player_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.auction_type != "dutch":
        raise HTTPException(status_code=400, detail="Not a Dutch auction")

    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if player.status != "unsold":
        raise HTTPException(status_code=400, detail="Player is not available")

    start_price = auction.dutch_start_price or player.base_price * 5

    auction.current_player_id = player_id
    auction.current_bid = start_price
    auction.current_team_id = None
    auction.dutch_current_price = start_price
    auction.dutch_start_price = start_price
    auction.status = "dutch_active"
    db.commit()

    await ws_manager.broadcast(auction.id, {
        "type": "dutch_start",
        "player_name": player.name,
        "player_id": player.id,
        "start_price": start_price,
        "current_price": start_price,
        "decrement": auction.dutch_decrement,
        "interval": auction.dutch_interval,
        "status": "dutch_active",
    })

    record_event(auction.id, "dutch_start", {
        "player_id": player.id, "player_name": player.name,
        "start_price": start_price, "decrement": auction.dutch_decrement,
    }, db)

    # Start background price ticker
    from db.database import SessionLocal
    asyncio.create_task(_dutch_price_ticker(auction.id, SessionLocal))

    return {
        "message": "Dutch auction started",
        "start_price": start_price,
        "decrement": auction.dutch_decrement,
        "interval": auction.dutch_interval,
    }


@router.post("/dutch-accept")
async def accept_dutch_price(
    team_id: int = Query(...),
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "dutch_active").first()

    if not auction or auction.status != "dutch_active":
        raise HTTPException(status_code=400, detail="No active Dutch auction")

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    sold_price = auction.dutch_current_price
    if not sold_price:
        raise HTTPException(status_code=400, detail="No current Dutch price")

    if team.remaining_budget < sold_price:
        raise HTTPException(status_code=400, detail="Insufficient budget")

    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).count()
    if team_players >= team.max_players:
        raise HTTPException(status_code=400, detail="Team has reached max players")

    player = db.query(Player).filter(Player.id == auction.current_player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="No current player")

    # Lock in the sale — stop the Dutch ticker by setting status
    auction.status = "live"
    auction.current_bid = sold_price
    auction.current_team_id = team.id
    auction.dutch_current_price = None
    db.commit()

    from routes.auction import _complete_sale
    result = await _complete_sale(auction, player, team, sold_price, db)

    record_event(auction.id, "dutch_accept", {
        "player_id": player.id, "player_name": player.name,
        "team_id": team.id, "team_name": team.name,
        "price": sold_price,
    }, db)

    return result


# ── Proxy Bidding ──────────────────────────────────────────

@router.post("/proxy-bid")
async def set_proxy_bid(
    team_id: int = Query(...),
    player_id: int = Query(...),
    max_amount: float = Query(...),
    auction_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).filter(Auction.status == "live").first()

    if not auction:
        raise HTTPException(status_code=400, detail="No live auction")
    if auction.auction_type != "proxy":
        raise HTTPException(status_code=400, detail="Not a proxy auction")

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.remaining_budget < max_amount:
        raise HTTPException(status_code=400, detail="Insufficient budget for max proxy amount")

    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if max_amount < player.base_price:
        raise HTTPException(status_code=400, detail="Proxy max must be at least base price")

    # Upsert: update existing or create new
    existing = db.query(ProxyBid).filter(
        ProxyBid.auction_id == auction.id,
        ProxyBid.team_id == team_id,
        ProxyBid.player_id == player_id,
        ProxyBid.active == 1,
    ).first()

    if existing:
        existing.max_amount = max_amount
        db.commit()
        return {"message": "Proxy bid updated", "max_amount": max_amount}

    proxy = ProxyBid(
        auction_id=auction.id,
        team_id=team_id,
        player_id=player_id,
        max_amount=max_amount,
    )
    db.add(proxy)
    db.commit()

    await ws_manager.broadcast(auction.id, {
        "type": "proxy_bid_set",
        "team_name": team.name,
        "team_short": team.short_name,
        "team_id": team.id,
        "player_id": player_id,
        "player_name": player.name,
    })

    record_event(auction.id, "proxy_bid_set", {
        "team_id": team_id, "team_name": team.name,
        "player_id": player_id, "max_amount": max_amount,
    }, db)

    return {"message": "Proxy bid set", "max_amount": max_amount}


@router.get("/proxy-bids")
async def get_proxy_bids(
    auction_id: int = Query(...),
    player_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = db.query(ProxyBid).filter(ProxyBid.auction_id == auction_id, ProxyBid.active == 1)
    if player_id:
        query = query.filter(ProxyBid.player_id == player_id)

    proxies = query.all()
    result = []
    for p in proxies:
        team = db.query(Team).filter(Team.id == p.team_id).first()
        player = db.query(Player).filter(Player.id == p.player_id).first()
        result.append({
            "id": p.id,
            "team_id": p.team_id,
            "team_name": team.name if team else None,
            "player_id": p.player_id,
            "player_name": player.name if player else None,
            "max_amount": p.max_amount,
        })

    return result


def run_proxy_auto_bid(auction: Auction, new_bid_amount: float, bidding_team_id: int, db: Session):
    """After a bid is placed, check if any proxy bids should auto-bid.
    Called from the bid handler in bids.py for proxy-type auctions."""
    player_id = auction.current_player_id
    if not player_id:
        return []

    proxy_bids = db.query(ProxyBid).filter(
        ProxyBid.auction_id == auction.id,
        ProxyBid.player_id == player_id,
        ProxyBid.active == 1,
        ProxyBid.team_id != bidding_team_id,
    ).all()

    auto_bids = []
    for proxy in proxy_bids:
        from routes.slabs import get_next_bid_amount
        next_amount = get_next_bid_amount(auction.id, new_bid_amount, db)

        if next_amount and next_amount <= proxy.max_amount:
            team = db.query(Team).filter(Team.id == proxy.team_id).first()
            if team and team.remaining_budget >= next_amount:
                bid = Bid(
                    auction_id=auction.id,
                    team_id=proxy.team_id,
                    player_id=player_id,
                    amount=next_amount,
                    timestamp=datetime.utcnow(),
                )
                db.add(bid)
                auction.current_bid = next_amount
                auction.current_team_id = proxy.team_id
                new_bid_amount = next_amount  # Update for next proxy check
                auto_bids.append({
                    "team_id": proxy.team_id,
                    "team_name": team.name,
                    "team_short": team.short_name,
                    "amount": next_amount,
                })
            else:
                # Team can't afford it — deactivate proxy
                proxy.active = 0
        else:
            # Max exceeded — deactivate proxy
            proxy.active = 0

    if auto_bids:
        db.commit()

    return auto_bids
