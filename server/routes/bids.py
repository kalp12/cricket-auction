from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from db.database import get_db
from models.models import Bid, Auction, Team
from routes.slabs import get_next_bid_amount
import json
from typing import Dict, List

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, auction_id: int, websocket: WebSocket):
        await websocket.accept()
        if auction_id not in self.connections:
            self.connections[auction_id] = []
        self.connections[auction_id].append(websocket)

    def disconnect(self, auction_id: int, websocket: WebSocket):
        if auction_id in self.connections:
            if websocket in self.connections[auction_id]:
                self.connections[auction_id].remove(websocket)

    async def broadcast(self, auction_id: int, message: dict):
        if auction_id not in self.connections:
            return
        dead = []
        for ws in self.connections[auction_id]:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections[auction_id].remove(ws)


manager = ConnectionManager()


@router.websocket("/ws/auction/{auction_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    auction_id: int,
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

    await manager.connect(auction_id, websocket)

    try:
        await websocket.send_text(json.dumps({
            "type": "state",
            "auction_id": auction_id,
            "status": auction.status,
            "current_bid": auction.current_bid,
            "current_player_id": auction.current_player_id,
            "current_team_id": auction.current_team_id,
            "timer_seconds": auction.timer_seconds
        }))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps(
                    {"type": "error", "message": "Invalid JSON"}
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

                bid = Bid(
                    auction_id=auction_id,
                    team_id=team_id,
                    player_id=auction.current_player_id,
                    amount=amount
                )
                db.add(bid)
                auction.current_bid = amount
                auction.current_team_id = team_id
                # Reset timer to auction's configured duration
                timer_val = auction.timer_seconds if auction.timer_enabled else 30
                auction.timer_seconds = timer_val
                db.commit()

                await manager.broadcast(auction_id, {
                    "type": "bid_update",
                    "team_id": team_id,
                    "team_name": team.name,
                    "amount": amount,
                    "timer_seconds": timer_val
                })

            elif msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect(auction_id, websocket)
    except Exception as e:
        manager.disconnect(auction_id, websocket)
