from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.models import BidIncrementSlab, Auction
from schemas.slab import SlabCreate, SlabUpdate, SlabSchema, SlabBulkCreate
from auth.auth import get_current_user, require_role
from schemas.auth import UserResponse

router = APIRouter()


def get_default_slabs(auction_id: int) -> List[SlabCreate]:
    """IPL-style default bid increment slabs (amounts in rupees)"""
    return [
        SlabCreate(auction_id=auction_id, min_price=0, max_price=5000000, increment=1000000),
        SlabCreate(auction_id=auction_id, min_price=5000000, max_price=10000000, increment=2500000),
        SlabCreate(auction_id=auction_id, min_price=10000000, max_price=50000000, increment=2500000),
        SlabCreate(auction_id=auction_id, min_price=50000000, max_price=100000000, increment=5000000),
        SlabCreate(auction_id=auction_id, min_price=100000000, max_price=999999999, increment=10000000),
    ]


@router.get("", response_model=List[SlabSchema])
def list_slabs(auction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """List bid increment slabs for an auction"""
    return db.query(BidIncrementSlab).filter(
        BidIncrementSlab.auction_id == auction_id
    ).order_by(BidIncrementSlab.min_price).all()


@router.post("", response_model=SlabSchema, status_code=status.HTTP_201_CREATED)
def create_slab(slab: SlabCreate, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Create a bid increment slab"""
    auction = db.query(Auction).filter(Auction.id == slab.auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    db_slab = BidIncrementSlab(**slab.dict())
    db.add(db_slab)
    db.commit()
    db.refresh(db_slab)
    return db_slab


@router.post("/bulk", response_model=List[SlabSchema], status_code=status.HTTP_201_CREATED)
def create_slabs_bulk(data: SlabBulkCreate, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Create multiple slabs at once (replaces existing for that auction)"""
    auction_id = data.slabs[0].auction_id if data.slabs else None
    if not auction_id:
        raise HTTPException(status_code=400, detail="No slabs provided")

    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Delete existing slabs for this auction
    db.query(BidIncrementSlab).filter(BidIncrementSlab.auction_id == auction_id).delete()

    created = []
    for slab_data in data.slabs:
        db_slab = BidIncrementSlab(**slab_data.dict())
        db.add(db_slab)
        created.append(db_slab)

    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.post("/defaults/{auction_id}", response_model=List[SlabSchema], status_code=status.HTTP_201_CREATED)
def create_default_slabs(auction_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Create default IPL-style slabs for an auction"""
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    db.query(BidIncrementSlab).filter(BidIncrementSlab.auction_id == auction_id).delete()

    defaults = get_default_slabs(auction_id)
    created = []
    for slab_data in defaults:
        db_slab = BidIncrementSlab(**slab_data.dict())
        db.add(db_slab)
        created.append(db_slab)

    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.put("/{slab_id}", response_model=SlabSchema)
def update_slab(slab_id: int, slab_update: SlabUpdate, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Update a bid increment slab"""
    db_slab = db.query(BidIncrementSlab).filter(BidIncrementSlab.id == slab_id).first()
    if not db_slab:
        raise HTTPException(status_code=404, detail="Slab not found")
    update_data = slab_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_slab, key, value)
    db.commit()
    db.refresh(db_slab)
    return db_slab


@router.delete("/{slab_id}")
def delete_slab(slab_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(require_role("owner", "editor"))):
    """Delete a bid increment slab"""
    db_slab = db.query(BidIncrementSlab).filter(BidIncrementSlab.id == slab_id).first()
    if not db_slab:
        raise HTTPException(status_code=404, detail="Slab not found")
    db.delete(db_slab)
    db.commit()
    return {"message": "Slab deleted successfully"}


def get_next_bid_amount(auction_id: int, current_bid: float, db: Session) -> float:
    """Calculate the next valid bid amount based on increment slabs"""
    slabs = db.query(BidIncrementSlab).filter(
        BidIncrementSlab.auction_id == auction_id
    ).order_by(BidIncrementSlab.min_price).all()

    if not slabs:
        # Default increment: 10% of current bid, min 1 lakh
        increment = max(current_bid * 0.10, 100000)
        return current_bid + increment

    for slab in slabs:
        if slab.min_price <= current_bid < slab.max_price:
            return current_bid + slab.increment

    # Fallback: use the highest slab's increment
    return current_bid + slabs[-1].increment
