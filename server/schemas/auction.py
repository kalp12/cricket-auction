from pydantic import BaseModel
from typing import Optional, List, Any


class BidCreate(BaseModel):
    team_id: int
    amount: float


class AuctionResponse(BaseModel):
    id: int
    status: str
    current_player_id: Optional[int] = None
    current_player_name: Optional[str] = None
    current_bid: float
    current_team_id: Optional[int] = None
    current_team_name: Optional[str] = None
    timer_seconds: int


class AuctionStateResponse(BaseModel):
    current_auction: Optional[dict] = None
    current_player: Optional[dict] = None
    highest_bid: Optional[dict] = None
    bids_history: List[dict] = []
    all_teams: List[dict] = []
