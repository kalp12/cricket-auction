from pydantic import BaseModel
from typing import Optional, List


class SlabCreate(BaseModel):
    auction_id: int
    min_price: float
    max_price: float
    increment: float


class SlabUpdate(BaseModel):
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    increment: Optional[float] = None


class SlabSchema(BaseModel):
    id: int
    auction_id: int
    min_price: float
    max_price: float
    increment: float

    class Config:
        from_attributes = True


class SlabBulkCreate(BaseModel):
    slabs: List[SlabCreate]
