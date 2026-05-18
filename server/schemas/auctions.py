from pydantic import BaseModel
from typing import Optional, List

from schemas.slab import SlabSchema


class AuctionCreate(BaseModel):
    name: str = "Untitled Auction"
    timer_seconds: int = 60
    timer_enabled: int = 1
    base_bid: float = 1000000
    budget_per_team: float = 100000000
    min_players: int = 5
    max_players: int = 18
    image_url: Optional[str] = None


class AuctionUpdate(BaseModel):
    name: Optional[str] = None
    timer_seconds: Optional[int] = None
    timer_enabled: Optional[int] = None
    base_bid: Optional[float] = None
    budget_per_team: Optional[float] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    status: Optional[str] = None
    image_url: Optional[str] = None


class AuctionSchema(BaseModel):
    id: int
    name: str = "Untitled Auction"
    status: str
    current_player_id: Optional[int] = None
    current_bid: float
    current_team_id: Optional[int] = None
    timer_seconds: int
    timer_enabled: int = 1
    base_bid: float = 1000000
    budget_per_team: float = 100000000
    min_players: int = 5
    max_players: int = 18
    image_url: Optional[str] = None
    bid_slabs: List[SlabSchema] = []

    class Config:
        from_attributes = True
