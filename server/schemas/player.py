from pydantic import BaseModel, Field
from typing import Optional, List


class PlayerCreate(BaseModel):
    name: str
    role: str  # batsman/bowler/allrounder/wicketkeeper
    country: str
    base_price: float
    image_url: Optional[str] = None


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
    base_price: Optional[float] = None
    image_url: Optional[str] = None
    status: Optional[str] = None


class PlayerResponse(BaseModel):
    id: int
    name: str
    role: str
    country: str
    base_price: float
    image_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class PlayerListResponse(BaseModel):
    players: List[PlayerResponse]
    total: int