from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class BidSchema(BaseModel):
    id: int
    auction_id: int
    team_id: int
    player_id: int
    amount: float
    timestamp: datetime