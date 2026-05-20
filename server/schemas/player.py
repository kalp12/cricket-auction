from pydantic import BaseModel, Field
from typing import Optional, List


class PlayerCreate(BaseModel):
    auction_id: int
    name: str
    role: str  # batsman/bowler/allrounder/wicketkeeper
    country: str
    base_price: float
    image_url: Optional[str] = None
    matches: Optional[int] = 0
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    batting_avg: Optional[float] = 0.0
    batting_sr: Optional[float] = 0.0
    bowling_avg: Optional[float] = 0.0
    bowling_econ: Optional[float] = 0.0


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
    base_price: Optional[float] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    matches: Optional[int] = None
    runs: Optional[int] = None
    wickets: Optional[int] = None
    batting_avg: Optional[float] = None
    batting_sr: Optional[float] = None
    bowling_avg: Optional[float] = None
    bowling_econ: Optional[float] = None


class PlayerResponse(BaseModel):
    id: int
    auction_id: int
    name: str
    role: str
    country: str
    base_price: float
    image_url: Optional[str] = None
    status: str
    matches: int = 0
    runs: int = 0
    wickets: int = 0
    batting_avg: float = 0.0
    batting_sr: float = 0.0
    bowling_avg: float = 0.0
    bowling_econ: float = 0.0

    class Config:
        from_attributes = True


class PlayerListResponse(BaseModel):
    players: List[PlayerResponse]
    total: int
