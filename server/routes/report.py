from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import get_db
from auth.auth import get_current_user
from models.models import Player, Team, TeamPlayer, Bid, Auction

router = APIRouter(tags=["report"])


@router.get("/auction/{auction_id}/report")
async def get_auction_report(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        from fastapi import HTTPException
        raise HTTPException(404, "Auction not found")

    players = db.query(Player).filter(Player.auction_id == auction_id).all()
    teams = db.query(Team).filter(Team.auction_id == auction_id).all()
    team_ids = [t.id for t in teams]
    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id.in_(team_ids)).all()
    bids = db.query(Bid).filter(Bid.auction_id == auction_id).all()

    player_map = {p.id: p for p in players}
    team_map = {t.id: t for t in teams}
    tp_map = {tp.player_id: (tp.team_id, tp.bought_price) for tp in team_players}

    sold_count = sum(1 for p in players if p.status == "sold")
    unsold_count = sum(1 for p in players if p.status == "unsold")
    pending_count = sum(1 for p in players if p.status == "pending")
    total_spent = sum(tp.bought_price for tp in team_players)
    sold_prices = [tp.bought_price for tp in team_players]

    # Per-team summary
    team_summaries = []
    for team in teams:
        tp_list = [tp for tp in team_players if tp.team_id == team.id]
        roster = []
        for tp in tp_list:
            p = player_map.get(tp.player_id)
            if p:
                roster.append({
                    "id": p.id,
                    "name": p.name,
                    "role": p.role,
                    "country": p.country,
                    "bought_price": tp.bought_price,
                    "base_price": p.base_price,
                    "matches": p.matches or 0,
                    "runs": p.runs or 0,
                    "wickets": p.wickets or 0,
                    "batting_avg": p.batting_avg or 0,
                    "batting_sr": p.batting_sr or 0,
                    "bowling_avg": p.bowling_avg or 0,
                    "bowling_econ": p.bowling_econ or 0,
                    "rtm_used": p.rtm_used,
                })
        spent = sum(tp.bought_price for tp in tp_list)
        role_counts = {}
        for r in roster:
            role_counts[r["role"]] = role_counts.get(r["role"], 0) + 1

        team_summaries.append({
            "id": team.id,
            "name": team.name,
            "short_name": team.short_name,
            "logo_url": team.logo_url,
            "total_budget": team.total_budget,
            "remaining_budget": team.remaining_budget,
            "spent": spent,
            "players_bought": len(tp_list),
            "max_players": team.max_players,
            "role_counts": role_counts,
            "roster": roster,
        })

    # All sold players sorted by price desc
    sold_players = []
    for tp in team_players:
        p = player_map.get(tp.player_id)
        t = team_map.get(tp.team_id)
        if p and t:
            sold_players.append({
                "id": p.id,
                "name": p.name,
                "role": p.role,
                "country": p.country,
                "base_price": p.base_price,
                "bought_price": tp.bought_price,
                "team_id": t.id,
                "team_name": t.name,
                "team_short": t.short_name,
                "rtm_used": p.rtm_used,
            })
    sold_players.sort(key=lambda x: x["bought_price"], reverse=True)

    # Unsold players
    unsold_list = [{
        "id": p.id,
        "name": p.name,
        "role": p.role,
        "country": p.country,
        "base_price": p.base_price,
    } for p in players if p.status == "unsold"]

    # Top bids (most bids placed per team)
    bid_counts_by_team = {}
    for bid in bids:
        bid_counts_by_team[bid.team_id] = bid_counts_by_team.get(bid.team_id, 0) + 1
    team_bid_activity = []
    for tid, count in bid_counts_by_team.items():
        t = team_map.get(tid)
        if t:
            team_bid_activity.append({"team_name": t.name, "short_name": t.short_name, "bid_count": count})
    team_bid_activity.sort(key=lambda x: x["bid_count"], reverse=True)

    # RTM summary
    rtm_events = []
    for p in players:
        if p.rtm_used == 1:
            t = team_map.get(p.previous_team_id) if p.previous_team_id else None
            rtm_events.append({"player": p.name, "team": t.name if t else "Unknown", "result": "accepted"})
        elif p.rtm_used == 2:
            rtm_events.append({"player": p.name, "team": "N/A", "result": "declined"})

    return {
        "auction": {
            "id": auction.id,
            "name": auction.name,
            "status": auction.status,
            "rtm_enabled": bool(auction.rtm_enabled),
            "budget_per_team": auction.budget_per_team,
        },
        "summary": {
            "total_players": len(players),
            "sold": sold_count,
            "unsold": unsold_count,
            "pending": pending_count,
            "total_spent": total_spent,
            "avg_price": total_spent / sold_count if sold_count else 0,
            "max_price": max(sold_prices) if sold_prices else 0,
            "min_price": min(sold_prices) if sold_prices else 0,
            "total_bids": len(bids),
        },
        "teams": team_summaries,
        "sold_players": sold_players,
        "unsold_players": unsold_list,
        "team_bid_activity": team_bid_activity,
        "rtm_events": rtm_events,
    }
