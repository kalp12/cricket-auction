from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends

from db.database import get_db
from models.models import Auction, Player, Team

router = APIRouter()


def _budget_tier(remaining: float, total: float) -> str:
    """Return a vague budget tier instead of exact amounts for spectators."""
    if total <= 0:
        return "unknown"
    pct = remaining / total
    if pct > 0.7:
        return "high"
    if pct > 0.3:
        return "medium"
    return "low"


@router.get("/auctions/{auction_id}/public")
def get_public_auction(auction_id: int, db: Session = Depends(get_db)):
    """Public (unauthenticated) auction info for spectators — no exact budgets."""
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

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

    teams = db.query(Team).filter(Team.auction_id == auction_id).all()
    teams_public = []
    for t in teams:
        teams_public.append({
            "id": t.id,
            "name": t.name,
            "short_name": t.short_name,
            "logo_url": t.logo_url,
            "budget_tier": _budget_tier(t.remaining_budget, t.total_budget),
        })

    sold_count = db.query(Player).filter(Player.auction_id == auction_id, Player.status == "sold").count()
    total_count = db.query(Player).filter(Player.auction_id == auction_id).count()

    return {
        "id": auction.id,
        "name": auction.name,
        "status": auction.status,
        "current_bid": auction.current_bid,
        "current_player": player_data,
        "current_team": team_data,
        "teams": teams_public,
        "sold_count": sold_count,
        "total_players": total_count,
        "timer_mode": auction.timer_mode,
        "timer_seconds": auction.timer_seconds,
        "sponsor_tl": auction.sponsor_tl,
        "sponsor_tr": auction.sponsor_tr,
        "sponsor_bl": auction.sponsor_bl,
        "sponsor_br": auction.sponsor_br,
        "sponsor_title": auction.sponsor_title,
        "sponsor_player": auction.sponsor_player,
        "overlay_bg": auction.overlay_bg,
        "sold_stamp": auction.sold_stamp,
        "unsold_stamp": auction.unsold_stamp,
    }


@router.get("/auction/state/public")
def get_public_auction_state(auction_id: int = None, db: Session = Depends(get_db)):
    """Public (unauthenticated) auction state for spectators."""
    if auction_id:
        auction = db.query(Auction).filter(Auction.id == auction_id).first()
    else:
        auction = db.query(Auction).first()

    if not auction:
        raise HTTPException(status_code=404, detail="No auction found")

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

    teams = db.query(Team).filter(Team.auction_id == auction.id).all()
    teams_public = []
    for t in teams:
        teams_public.append({
            "id": t.id,
            "name": t.name,
            "short_name": t.short_name,
            "logo_url": t.logo_url,
            "budget_tier": _budget_tier(t.remaining_budget, t.total_budget),
        })

    return {
        "id": auction.id,
        "name": auction.name,
        "status": auction.status,
        "current_bid": auction.current_bid,
        "current_player": player_data,
        "current_team": team_data,
        "teams": teams_public,
        "timer_mode": auction.timer_mode,
        "sponsor_tl": auction.sponsor_tl,
        "sponsor_tr": auction.sponsor_tr,
        "sponsor_bl": auction.sponsor_bl,
        "sponsor_br": auction.sponsor_br,
        "sponsor_title": auction.sponsor_title,
        "sponsor_player": auction.sponsor_player,
        "overlay_bg": auction.overlay_bg,
        "sold_stamp": auction.sold_stamp,
        "unsold_stamp": auction.unsold_stamp,
    }
