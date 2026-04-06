from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session

from db.database import get_db
from auth.auth import get_current_user
from models.models import Team, TeamPlayer, Player
from schemas.team import TeamCreate, TeamUpdate, TeamResponse, TeamDetailResponse

router = APIRouter(tags=["teams"])


@router.post("", response_model=TeamResponse)
async def create_team(team: TeamCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team_dict = team.dict()
    team_dict["remaining_budget"] = team_dict["total_budget"]
    db_team = Team(**team_dict)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.get("", response_model=List[TeamResponse])
async def get_teams(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    teams = db.query(Team).all()
    return teams


@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team(team_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Get players bought by this team
    team_players = db.query(TeamPlayer).filter(TeamPlayer.team_id == team_id).all()
    players_list = []
    for tp in team_players:
        player = db.query(Player).filter(Player.id == tp.player_id).first()
        if player:
            players_list.append({
                "id": player.id,
                "name": player.name,
                "role": player.role,
                "country": player.country,
                "bought_price": tp.bought_price
            })

    return TeamDetailResponse(
        id=team.id,
        name=team.name,
        total_budget=team.total_budget,
        remaining_budget=team.remaining_budget,
        max_players=team.max_players,
        logo_url=team.logo_url,
        players=players_list
    )


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(team_id: int, team_update: TeamUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    update_data = team_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(team, key, value)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}")
async def delete_team(team_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully"}


@router.get("/{team_id}/budget")
async def get_team_budget(team_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    players_count = db.query(TeamPlayer).filter(TeamPlayer.team_id == team_id).count()
    spent = team.total_budget - team.remaining_budget

    return {
        "team_id": team.id,
        "team_name": team.name,
        "total_budget": team.total_budget,
        "remaining_budget": team.remaining_budget,
        "spent": spent,
        "players_count": players_count,
        "max_players": team.max_players,
        "can_bid": team.remaining_budget > 0 and players_count < team.max_players
    }