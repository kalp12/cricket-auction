from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    role = Column(String, default="viewer")  # owner / editor / viewer
    invite_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


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

    previous_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    rtm_used = Column(Integer, default=0)  # 0=not used, 1=RTM accepted, 2=RTM declined

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
    status = Column(String, default="waiting")  # waiting/live/paused/ended/rtm_pending/sealed_reveal/dutch_active
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

    # Auction type: english (default), sealed, dutch, proxy
    auction_type = Column(String, default="english")

    # Dutch auction fields
    dutch_start_price = Column(Float, nullable=True)
    dutch_current_price = Column(Float, nullable=True)
    dutch_decrement = Column(Float, default=100000)
    dutch_interval = Column(Integer, default=10)

    # Sponsor corner logos
    sponsor_tl = Column(String, nullable=True)  # top-left
    sponsor_tr = Column(String, nullable=True)  # top-right
    sponsor_bl = Column(String, nullable=True)  # bottom-left
    sponsor_br = Column(String, nullable=True)  # bottom-right
    # Additional sponsor slots
    sponsor_title = Column(String, nullable=True)  # title/main sponsor banner
    sponsor_player = Column(String, nullable=True)  # player card sponsor badge

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

    # Right to Match
    rtm_enabled = Column(Integer, default=0) # 0=disabled, 1=enabled

    # Player registration
    registration_open = Column(Integer, default=0)  # 0=closed, 1=open
    registration_deadline = Column(DateTime, nullable=True)
    registration_form_config = Column(String, nullable=True)  # JSON

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
    is_sealed = Column(Integer, default=0) # 1=sealed bid (hidden until reveal)
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
    email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", foreign_keys=[auction_id])

class StatUpdate(Base):
    __tablename__ = "stat_updates"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    source = Column(String, nullable=False)  # manual / espn_cricinfo / cricbuzz / custom
    old_matches = Column(Integer, nullable=True)
    new_matches = Column(Integer, nullable=True)
    old_runs = Column(Integer, nullable=True)
    new_runs = Column(Integer, nullable=True)
    old_wickets = Column(Integer, nullable=True)
    new_wickets = Column(Integer, nullable=True)
    old_batting_avg = Column(Float, nullable=True)
    new_batting_avg = Column(Float, nullable=True)
    old_batting_sr = Column(Float, nullable=True)
    new_batting_sr = Column(Float, nullable=True)
    old_bowling_avg = Column(Float, nullable=True)
    new_bowling_avg = Column(Float, nullable=True)
    old_bowling_econ = Column(Float, nullable=True)
    new_bowling_econ = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    player = relationship("Player", backref="stat_updates")


class AuctionEvent(Base):
    __tablename__ = "auction_events"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    event_type = Column(String, nullable=False)  # bid/sold/unsold/start/pause/resume/next_player/rtm_prompt/rtm_accept/rtm_decline
    data = Column(String, nullable=False)  # JSON string: {team_id, team_name, amount, player_id, player_name, ...}
    snapshot = Column(String, nullable=True)  # JSON string: full auction state at this moment
    timestamp = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", backref="events")


class ProxyBid(Base):
    __tablename__ = "proxy_bids"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    max_amount = Column(Float, nullable=False)
    active = Column(Integer, default=1) # 1=active, 0=exhausted/won
    created_at = Column(DateTime, default=datetime.utcnow)

    auction = relationship("Auction", foreign_keys=[auction_id])
    team = relationship("Team", foreign_keys=[team_id])
    player = relationship("Player", foreign_keys=[player_id])
