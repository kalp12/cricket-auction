from pydantic import BaseModel, Field
from typing import Optional, List


class TeamCreate(BaseModel):
    auction_id: int
    name: str
    short_name: Optional[str] = None
    total_budget: float = Field(..., gt=0)
    max_players: int = Field(18, ge=1, le=30)
    logo_url: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    total_budget: Optional[float] = Field(None, gt=0)
    max_players: Optional[int] = Field(None, ge=1, le=30)
    logo_url: Optional[str] = None


class TeamResponse(BaseModel):
    id: int
    auction_id: int
    name: str
    short_name: Optional[str] = None
    total_budget: float
    remaining_budget: float
    max_players: int
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


class TeamDetailResponse(TeamResponse):
    players: List[dict] = []

    class Config:
        from_attributes = True
