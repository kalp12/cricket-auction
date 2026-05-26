import json
from sqlalchemy.orm import Session
from models.models import AuctionEvent, Auction, Team, Player


def capture_auction_snapshot(auction_id: int, db: Session) -> dict:
    """Capture the current auction state as a dict for replay."""
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        return {}

    teams = db.query(Team).filter(Team.auction_id == auction_id).all()
    team_snapshots = []
    for t in teams:
        team_snapshots.append({
            "id": t.id,
            "name": t.name,
            "short_name": t.short_name,
            "remaining_budget": t.remaining_budget,
            "total_budget": t.total_budget,
        })

    current_player = None
    if auction.current_player_id:
        p = db.query(Player).filter(Player.id == auction.current_player_id).first()
        if p:
            current_player = {
                "id": p.id,
                "name": p.name,
                "role": p.role,
                "country": p.country,
                "base_price": p.base_price,
                "image_url": p.image_url,
            }

    current_team = None
    if auction.current_team_id:
        t = db.query(Team).filter(Team.id == auction.current_team_id).first()
        if t:
            current_team = {"id": t.id, "name": t.name, "short_name": t.short_name}

    return {
        "status": auction.status,
        "current_bid": auction.current_bid,
        "current_player_id": auction.current_player_id,
        "current_team_id": auction.current_team_id,
        "current_player": current_player,
        "current_team": current_team,
        "teams": team_snapshots,
        "timer_seconds": auction.timer_seconds,
        "timer_mode": auction.timer_mode,
    }


def record_event(auction_id: int, event_type: str, data: dict, db: Session, snapshot: dict = None):
    """Record an auction event for replay."""
    if snapshot is None:
        snapshot = capture_auction_snapshot(auction_id, db)

    event = AuctionEvent(
        auction_id=auction_id,
        event_type=event_type,
        data=json.dumps(data, default=str),
        snapshot=json.dumps(snapshot, default=str) if snapshot else None,
    )
    db.add(event)
    db.commit()
