from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class AuctionStatus(str, Enum):
    WAITING = "waiting"
    LIVE = "live"
    PAUSED = "paused"
    ENDED = "ended"


class BidCreate(BaseModel):
    team_id: int
    amount: float


class BidResponse(BaseModel):
    id: int
    auction_id: int
    team_id: int
    player_id: int
    amount: float
    timestamp: datetime


class AuctionResponse(BaseModel):
    id: int
    status: AuctionStatus
    current_player_id: Optional[int] = None
    current_player_name: Optional[str] = None
    current_bid: float
    current_team_id: Optional[int] = None
    current_team_name: Optional[str] = None
    timer_seconds: int


class AuctionStateResponse(BaseModel):
    current_auction: dict  # AuctionResponse
    current_player: dict  # PlayerResponse
    highest_bid: dict  # {team_id: int, amount: float}
    bids_history: List[BidResponse]
    all_teams: List[dict]  # {team_id: int, name: str, remaining_budget: float}