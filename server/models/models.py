from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from db.database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # batsman/bowler/allrounder/wicketkeeper
    country = Column(String, nullable=False)
    base_price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    status = Column(String, default="unsold")  # unsold/sold/pending

    # Cricket stats
    matches = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    wickets = Column(Integer, default=0)
    batting_avg = Column(Float, default=0.0)
    batting_sr = Column(Float, default=0.0)
    bowling_avg = Column(Float, default=0.0)
    bowling_econ = Column(Float, default=0.0)

    auction = relationship("Auction", foreign_keys=[auction_id])
    bids = relationship("Bid", back_populates="player")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    name = Column(String, nullable=False)
    short_name = Column(String, nullable=True)
    total_budget = Column(Float, nullable=False)
    remaining_budget = Column(Float, nullable=False)
    max_players = Column(Integer, default=18)
    logo_url = Column(String, nullable=True)

    auction = relationship("Auction", foreign_keys=[auction_id])
    bids = relationship("Bid", back_populates="team")


class TeamPlayer(Base):
    __tablename__ = "team_players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    bought_price = Column(Float, nullable=False)

    team = relationship("Team", backref="purchased_players")
    player = relationship("Player", backref="team_assignments")


class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Untitled Auction")
    status = Column(String, default="waiting")  # waiting/live/paused/ended
    current_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    current_bid = Column(Float, default=0)
    current_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    timer_seconds = Column(Integer, default=60)
    timer_mode = Column(String, default="auto")  # auto/manual/off
    base_bid = Column(Float, default=1000000)  # 10 lakh default
    budget_per_team = Column(Float, default=100000000)  # 100 crore
    min_players = Column(Integer, default=5)
    max_players = Column(Integer, default=18)
    image_url = Column(String, nullable=True)

    # Sponsor corner logos
    sponsor_tl = Column(String, nullable=True)  # top-left
    sponsor_tr = Column(String, nullable=True)  # top-right
    sponsor_bl = Column(String, nullable=True)  # bottom-left
    sponsor_br = Column(String, nullable=True)  # bottom-right

    # Custom overlay assets
    overlay_bg = Column(String, nullable=True)
    sold_stamp = Column(String, nullable=True)
    unsold_stamp = Column(String, nullable=True)
    lower_third_banner = Column(String, nullable=True)

    # Sound effects (file URLs)
    sound_gavel = Column(String, nullable=True)
    sound_unsold = Column(String, nullable=True)
    sound_timer = Column(String, nullable=True)
    sound_celebration = Column(String, nullable=True)
    registration_open = Column(Integer, default=0)  # 0=closed, 1=open

    current_player = relationship("Player", foreign_keys=[current_player_id])
    current_team = relationship("Team", foreign_keys=[current_team_id])
    players = relationship("Player", foreign_keys="[Player.auction_id]", overlaps="auction")
    teams = relationship("Team", foreign_keys="[Team.auction_id]", overlaps="auction")
    bids = relationship("Bid", back_populates="auction")


class BidIncrementSlab(Base):
    __tablename__ = "bid_increment_slabs"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    min_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    increment = Column(Float, nullable=False)

    auction = relationship("Auction", backref="bid_slabs")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", back_populates="bids")
    team = relationship("Team", back_populates="bids")
    player = relationship("Player", back_populates="bids")



class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    country = Column(String, nullable=False)
    base_price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    matches = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    wickets = Column(Integer, default=0)
    batting_avg = Column(Float, default=0.0)
    batting_sr = Column(Float, default=0.0)
    bowling_avg = Column(Float, default=0.0)
    bowling_econ = Column(Float, default=0.0)
    status = Column(String, default="pending")  # pending/approved/rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", foreign_keys=[auction_id])
