from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from db.database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # batsman/bowler/allrounder/wicketkeeper
    country = Column(String, nullable=False)
    base_price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    status = Column(String, default="unsold")  # unsold/sold/pending

    bids = relationship("Bid", back_populates="player")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    total_budget = Column(Float, nullable=False)
    remaining_budget = Column(Float, nullable=False)
    max_players = Column(Integer, default=15)
    logo_url = Column(String, nullable=True)

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
    status = Column(String, default="waiting")  # waiting/live/paused/ended
    current_player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    current_bid = Column(Float, default=0)
    current_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    timer_seconds = Column(Integer, default=60)

    current_player = relationship("Player", backref="auctions")
    current_team = relationship("Team", backref="current_auctions")
    bids = relationship("Bid", back_populates="auction")


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