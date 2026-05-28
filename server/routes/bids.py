from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from db.database import get_db
from models.models import Bid, Auction, Team, Player, TeamPlayer
from routes.slabs import get_next_bid_amount
from event_recorder import record_event
import json
from datetime import datetime
from typing import Dict, List, Tuple

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # Each entry: (WebSocket, mode) where mode is "admin" or "spectator"
        self.connections: Dict[int, List[Tuple[WebSocket, str]]] = {}

    async def connect(self, auction_id: int, websocket: WebSocket, mode: str = "admin"):
        await websocket.accept()
        if auction_id not in self.connections:
            self.connections[auction_id] = []
        self.connections[auction_id].append((websocket, mode))

    def disconnect(self, auction_id: int, websocket: WebSocket):
        if auction_id in self.connections:
            self.connections[auction_id] = [
                (ws, m) for ws, m in self.connections[auction_id] if ws != websocket
            ]

    def get_mode(self, auction_id: int, websocket: WebSocket) -> str:
        if auction_id in self.connections:
            for ws, mode in self.connections[auction_id]:
                if ws == websocket:
                    return mode
        return "admin"

    async def broadcast(self, auction_id: int, message: dict):
        if auction_id not in self.connections:
            return
        dead = []
        for ws, mode in self.connections[auction_id]:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections[auction_id] = [
                (w, m) for w, m in self.connections[auction_id] if w != ws
            ]


manager = ConnectionManager()


@router.websocket("/ws/auction/{auction_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    auction_id: int,
    mode: str = Query("admin"),
    db: Session = Depends(get_db)
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        await websocket.accept()
        await websocket.send_text(json.dumps(
            {"type": "error", "message": "Auction not found"}
        ))
        await websocket.close(code=1008)
        return

    is_spectator = mode == "spectator"
    await manager.connect(auction_id, websocket, mode)

    try:
        # Build initial state — filter sensitive data for spectators
        player_data = None
        if auction.current_player_id:
            p = db.query(Player).filter(Player.id == auction.current_player_id).first()
            if p:
                player_data = {
                    "id": p.id,
                    "name": p.name,
                    "role": p.role,
                    "country": p.country,
                    "base_price": p.base_price,
                    "image_url": p.image_url,
                    "matches": p.matches,
                    "runs": p.runs,
                    "wickets": p.wickets,
                    "batting_avg": p.batting_avg,
                    "batting_sr": p.batting_sr,
                    "bowling_avg": p.bowling_avg,
                    "bowling_econ": p.bowling_econ,
                }

        team_data = None
        if auction.current_team_id:
            t = db.query(Team).filter(Team.id == auction.current_team_id).first()
            if t:
                team_data = {
                    "id": t.id,
                    "name": t.name,
                    "short_name": t.short_name,
                    "logo_url": t.logo_url,
                }

        state_msg = {
            "type": "state",
            "auction_id": auction_id,
            "status": auction.status,
            "current_bid": auction.current_bid,
            "current_player_id": auction.current_player_id,
            "current_team_id": auction.current_team_id,
            "timer_seconds": auction.timer_seconds,
            "timer_mode": auction.timer_mode,
            "current_player": player_data,
            "current_team": team_data,
            "mode": mode,  # tell client what mode they're in
            "overlay_bg": auction.overlay_bg,
            "sold_stamp": auction.sold_stamp,
            "unsold_stamp": auction.unsold_stamp,
            "sponsor_tl": auction.sponsor_tl,
            "sponsor_tr": auction.sponsor_tr,
            "sponsor_bl": auction.sponsor_bl,
            "sponsor_br": auction.sponsor_br,
            "auction_type": auction.auction_type,
            "dutch_current_price": auction.dutch_current_price,
            "dutch_decrement": auction.dutch_decrement,
            "dutch_interval": auction.dutch_interval,
        }

        await websocket.send_text(json.dumps(state_msg))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps(
                    {"type": "error", "message": "Invalid JSON"}
                ))
                continue

            # Reject bids from spectators
            if msg.get("type") == "bid" and is_spectator:
                await websocket.send_text(json.dumps(
                    {"type": "error", "message": "Spectators cannot bid"}
                ))
                continue

            if msg.get("type") == "bid":
                team_id = msg.get("team_id")
                amount = msg.get("amount")
                auto = msg.get("auto", False)

                if not team_id:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "team_id required"}
                    ))
                    continue

                db.refresh(auction)
                team = db.query(Team).filter(Team.id == team_id).first()

                if not team:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "Team not found"}
                    ))
                    continue

                if auction.status != "live":
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "Auction is not live"}
                    ))
                    continue

                # Prevent same-team consecutive bids on same player
                if auction.current_team_id == team_id:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "Cannot place consecutive bids on same player"}
                    ))
                    continue

                # Auto-increment: calculate next valid bid from slabs
                if auto and not amount:
                    amount = get_next_bid_amount(auction_id, auction.current_bid, db)

                if not amount:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "amount required (or set auto=true)"}
                    ))
                    continue

                if amount <= auction.current_bid:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message":
                         f"Bid must exceed current bid of {auction.current_bid}"}
                    ))
                    continue

                if amount > team.remaining_budget:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "Insufficient budget"}
                    ))
                    continue

                team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).count()
                if team_players >= team.max_players:
                    await websocket.send_text(json.dumps(
                        {"type": "error", "message": "Team has reached max players"}
                    ))
                    continue

                bid = Bid(
                    auction_id=auction_id,
                    team_id=team_id,
                    player_id=auction.current_player_id,
                    amount=amount
                )
                db.add(bid)
                auction.current_bid = amount
                auction.current_team_id = team_id
                timer_val = auction.timer_seconds if auction.timer_mode == "auto" else 0
                db.commit()

                await manager.broadcast(auction_id, {
                    "type": "bid_update",
                    "team_id": team_id,
                    "team_name": team.name,
                    "team_short": team.short_name,
                    "amount": amount,
                    "timer_seconds": timer_val,
                })

                # Record bid event for replay
                player = db.query(Player).filter(Player.id == auction.current_player_id).first()
                record_event(auction_id, "bid", {
                    "team_id": team_id, "team_name": team.name,
                    "player_id": auction.current_player_id, "player_name": player.name if player else None,
                    "amount": amount,
                }, db)

            elif msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect(auction_id, websocket)
    except Exception as e:
        manager.disconnect(auction_id, websocket)
