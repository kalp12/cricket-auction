from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import get_db
from auth.auth import get_current_user
from models.models import Player, Team, TeamPlayer, Bid

router = APIRouter(tags=["stats"])


@router.get("/auction/{auction_id}/stats")
async def get_auction_stats(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Total players and breakdown
    total_players = db.query(Player).filter(Player.auction_id == auction_id).count()
    sold_players = db.query(Player).filter(Player.auction_id == auction_id, Player.status == "sold").count()
    unsold_players = db.query(Player).filter(Player.auction_id == auction_id, Player.status == "unsold").count()

    # Role breakdown
    role_breakdown = db.query(Player.role, func.count(Player.id)).filter(
        Player.auction_id == auction_id
    ).group_by(Player.role).all()

    # Country breakdown
    country_breakdown = db.query(Player.country, func.count(Player.id)).filter(
        Player.auction_id == auction_id
    ).group_by(Player.country).all()

    # Purchase stats from TeamPlayer
    purchases = db.query(TeamPlayer).join(Team).filter(Team.auction_id == auction_id).all()
    total_spent = sum(tp.bought_price for tp in purchases)
    sold_prices = [tp.bought_price for tp in purchases]

    avg_price = total_spent / len(sold_prices) if sold_prices else 0
    max_price = max(sold_prices) if sold_prices else 0
    min_price = min(sold_prices) if sold_prices else 0

    # Most expensive player
    most_expensive = None
    if purchases:
        top = max(purchases, key=lambda tp: tp.bought_price)
        player = db.query(Player).filter(Player.id == top.player_id).first()
        team = db.query(Team).filter(Team.id == top.team_id).first()
        if player and team:
            most_expensive = {
                "player_name": player.name,
                "team_name": team.name,
                "price": top.bought_price,
            }

    # Per-role average price
    role_avg_price = {}
    for tp in purchases:
        player = db.query(Player).filter(Player.id == tp.player_id).first()
        if player:
            role = player.role
            if role not in role_avg_price:
                role_avg_price[role] = {"total": 0, "count": 0}
            role_avg_price[role]["total"] += tp.bought_price
            role_avg_price[role]["count"] += 1
    role_avg = {role: data["total"] / data["count"] for role, data in role_avg_price.items()}

    # Per-team spending
    team_spending = []
    teams = db.query(Team).filter(Team.auction_id == auction_id).all()
    for team in teams:
        team_purchases = db.query(TeamPlayer).filter(TeamPlayer.team_id == team.id).all()
        spent = sum(tp.bought_price for tp in team_purchases)
        player_count = len(team_purchases)
        team_spending.append({
            "team_id": team.id,
            "team_name": team.name,
            "short_name": team.short_name,
            "total_budget": team.total_budget,
            "remaining_budget": team.remaining_budget,
            "spent": spent,
            "players_bought": player_count,
        })

    # Top batsmen by runs
    top_batsmen = db.query(Player).filter(
        Player.auction_id == auction_id, Player.role.in_(["batsman", "allrounder", "wicketkeeper"])
    ).order_by(Player.runs.desc()).limit(5).all()

    # Top bowlers by wickets
    top_bowlers = db.query(Player).filter(
        Player.auction_id == auction_id, Player.role.in_(["bowler", "allrounder"])
    ).order_by(Player.wickets.desc()).limit(5).all()

    # Highest base prices
    highest_base = db.query(Player).filter(
        Player.auction_id == auction_id
    ).order_by(Player.base_price.desc()).limit(5).all()

    return {
        "overview": {
            "total_players": total_players,
            "sold": sold_players,
            "unsold": unsold_players,
            "total_spent": total_spent,
            "avg_price": avg_price,
            "max_price": max_price,
            "min_price": min_price,
        },
        "role_breakdown": [{"role": r, "count": c} for r, c in role_breakdown],
        "country_breakdown": [{"country": c, "count": cnt} for c, cnt in country_breakdown],
        "most_expensive": most_expensive,
        "role_avg_price": role_avg,
        "team_spending": team_spending,
        "top_batsmen": [
            {"name": p.name, "role": p.role, "runs": p.runs, "matches": p.matches,
             "batting_avg": p.batting_avg, "batting_sr": p.batting_sr, "status": p.status}
            for p in top_batsmen
        ],
        "top_bowlers": [
            {"name": p.name, "role": p.role, "wickets": p.wickets, "matches": p.matches,
             "bowling_avg": p.bowling_avg, "bowling_econ": p.bowling_econ, "status": p.status}
            for p in top_bowlers
        ],
        "highest_base": [
            {"name": p.name, "role": p.role, "country": p.country, "base_price": p.base_price, "status": p.status}
            for p in highest_base
        ],
    }
