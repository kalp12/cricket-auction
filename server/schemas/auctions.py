from pydantic import BaseModel
from typing import Optional, List

from schemas.slab import SlabSchema


class AuctionCreate(BaseModel):
    name: str = "Untitled Auction"
    auction_type: Optional[str] = None
    timer_seconds: int = 60
    timer_mode: str = "auto"  # auto/manual/off
    base_bid: float = 1000000
    budget_per_team: float = 100000000
    min_players: int = 5
    max_players: int = 18
    image_url: Optional[str] = None
    dutch_start_price: Optional[float] = None
    dutch_decrement: Optional[float] = None
    dutch_interval: Optional[int] = None


class AuctionUpdate(BaseModel):
    name: Optional[str] = None
    auction_type: Optional[str] = None
    timer_seconds: Optional[int] = None
    timer_mode: Optional[str] = None
    base_bid: Optional[float] = None
    budget_per_team: Optional[float] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    status: Optional[str] = None
    rtm_enabled: Optional[int] = None
    image_url: Optional[str] = None
    dutch_start_price: Optional[float] = None
    dutch_current_price: Optional[float] = None
    dutch_decrement: Optional[float] = None
    dutch_interval: Optional[int] = None
    sponsor_tl: Optional[str] = None
    sponsor_tr: Optional[str] = None
    sponsor_bl: Optional[str] = None
    sponsor_br: Optional[str] = None
    sponsor_title: Optional[str] = None
    sponsor_player: Optional[str] = None
    overlay_bg: Optional[str] = None
    sold_stamp: Optional[str] = None
    unsold_stamp: Optional[str] = None
    lower_third_banner: Optional[str] = None
    sound_gavel: Optional[str] = None
    sound_unsold: Optional[str] = None
    sound_timer: Optional[str] = None
    sound_celebration: Optional[str] = None


class AuctionSchema(BaseModel):
    id: int
    name: str = "Untitled Auction"
    status: str
    current_player_id: Optional[int] = None
    current_bid: float
    current_team_id: Optional[int] = None
    timer_seconds: int
    timer_mode: str = "auto"
    base_bid: float = 1000000
    budget_per_team: float = 100000000
    min_players: int = 5
    max_players: int = 18
    image_url: Optional[str] = None
    auction_type: str = "english"
    rtm_enabled: Optional[int] = None
    dutch_start_price: Optional[float] = None
    dutch_current_price: Optional[float] = None
    dutch_decrement: Optional[float] = None
    dutch_interval: Optional[int] = None
    sponsor_tl: Optional[str] = None
    sponsor_tr: Optional[str] = None
    sponsor_bl: Optional[str] = None
    sponsor_br: Optional[str] = None
    sponsor_title: Optional[str] = None
    sponsor_player: Optional[str] = None
    overlay_bg: Optional[str] = None
    sold_stamp: Optional[str] = None
    unsold_stamp: Optional[str] = None
    lower_third_banner: Optional[str] = None
    sound_gavel: Optional[str] = None
    sound_unsold: Optional[str] = None
    sound_timer: Optional[str] = None
    sound_celebration: Optional[str] = None
    bid_slabs: List[SlabSchema] = []

    class Config:
        from_attributes = True
