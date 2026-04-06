from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from sqlalchemy.orm import Session

from db.database import get_db
from auth.auth import get_current_user
from schemas.player import PlayerCreate, PlayerUpdate, PlayerResponse, PlayerListResponse
from models.models import Player, Team, TeamPlayer, Auction, Bid

router = APIRouter(tags=["players"])


@router.post("", response_model=PlayerResponse)
async def create_player(player: PlayerCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    player_dict = player.dict()
    db_player = Player(**player_dict)
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


@router.get("", response_model=PlayerListResponse)
async def get_players(
    role: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = db.query(Player)
    if role:
        query = query.filter(Player.role == role)
    if status:
        query = query.filter(Player.status == status)
    players = query.offset(skip).limit(limit).all()
    return {"players": players, "total": len(players)}


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player( player_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return player


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(player_id: int, player_update: PlayerUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    update_data = player_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(player, key, value)
    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}")
async def delete_player(player_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    db.delete(player)
    db.commit()
    return {"message": "Player deleted successfully"}


@router.post("/bulk", response_model=List[PlayerResponse])
async def bulk_create_players(players_data: List[PlayerCreate], db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    created_players = []
    for player_data in players_data:
        player = Player(**player_data.dict())
        db.add(player)
        db.commit()
        db.refresh(player)
        created_players.append(player)
    return created_players