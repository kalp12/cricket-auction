"""Seed the database with dummy cricket players and teams."""
import sys
sys.path.insert(0, '.')

from db.database import SessionLocal, engine, Base
import models.models # noqa: F401 - register models
from models.models import Player, Team, Auction, Bid, TeamPlayer, BidIncrementSlab

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Clear existing data and reset auto-increment
from sqlalchemy import text
db.execute(text("TRUNCATE TABLE bids, team_players, bid_increment_slabs, auctions, players, teams RESTART IDENTITY CASCADE"))
db.commit()

# Create auction first
auction = Auction(name="IPL Demo Auction", status="waiting", current_bid=0, timer_seconds=60,
                  timer_enabled=1, base_bid=1000000, budget_per_team=100000000,
                  min_players=5, max_players=18)
db.add(auction)
db.flush()

# --- Players ---
players_data = [
    # Batsmen
    {"name": "Virat Kohli", "role": "batsman", "country": "India", "base_price": 20000000},
    {"name": "Rohit Sharma", "role": "batsman", "country": "India", "base_price": 18000000},
    {"name": "Steve Smith", "role": "batsman", "country": "Australia", "base_price": 15000000},
    {"name": "Joe Root", "role": "batsman", "country": "England", "base_price": 12000000},
    {"name": "Kane Williamson", "role": "batsman", "country": "New Zealand", "base_price": 15000000},
    {"name": "Babar Azam", "role": "batsman", "country": "Pakistan", "base_price": 14000000},
    {"name": "David Warner", "role": "batsman", "country": "Australia", "base_price": 12000000},
    {"name": "Shubman Gill", "role": "batsman", "country": "India", "base_price": 10000000},
    {"name": "Travis Head", "role": "batsman", "country": "Australia", "base_price": 8000000},
    {"name": "Ruturaj Gaikwad", "role": "batsman", "country": "India", "base_price": 6000000},
    # Bowlers
    {"name": "Jasprit Bumrah", "role": "bowler", "country": "India", "base_price": 18000000},
    {"name": "Pat Cummins", "role": "bowler", "country": "Australia", "base_price": 15000000},
    {"name": "Shaheen Afridi", "role": "bowler", "country": "Pakistan", "base_price": 12000000},
    {"name": "Trent Boult", "role": "bowler", "country": "New Zealand", "base_price": 10000000},
    {"name": "Kagiso Rabada", "role": "bowler", "country": "South Africa", "base_price": 12000000},
    {"name": "Rashid Khan", "role": "bowler", "country": "Afghanistan", "base_price": 14000000},
    {"name": "Josh Hazlewood", "role": "bowler", "country": "Australia", "base_price": 8000000},
    {"name": "Mohammed Shami", "role": "bowler", "country": "India", "base_price": 8000000},
    {"name": "Mark Wood", "role": "bowler", "country": "England", "base_price": 6000000},
    {"name": "Yuzvendra Chahal", "role": "bowler", "country": "India", "base_price": 4000000},
    # All-rounders
    {"name": "Ben Stokes", "role": "allrounder", "country": "England", "base_price": 16000000},
    {"name": "Ravindra Jadeja", "role": "allrounder", "country": "India", "base_price": 14000000},
    {"name": "Shakib Al Hasan", "role": "allrounder", "country": "Bangladesh", "base_price": 10000000},
    {"name": "Cameron Green", "role": "allrounder", "country": "Australia", "base_price": 10000000},
    {"name": "Hardik Pandya", "role": "allrounder", "country": "India", "base_price": 15000000},
    {"name": "Marco Jansen", "role": "allrounder", "country": "South Africa", "base_price": 6000000},
    {"name": "Sam Curran", "role": "allrounder", "country": "England", "base_price": 10000000},
    {"name": "Ravichandran Ashwin", "role": "allrounder", "country": "India", "base_price": 8000000},
    {"name": "Mitchell Marsh", "role": "allrounder", "country": "Australia", "base_price": 6000000},
    {"name": "Dwayne Bravo", "role": "allrounder", "country": "West Indies", "base_price": 4000000},
    # Wicketkeepers
    {"name": "MS Dhoni", "role": "wicketkeeper", "country": "India", "base_price": 15000000},
    {"name": "Quinton de Kock", "role": "wicketkeeper", "country": "South Africa", "base_price": 10000000},
    {"name": "Jos Buttler", "role": "wicketkeeper", "country": "England", "base_price": 14000000},
    {"name": "Rishabh Pant", "role": "wicketkeeper", "country": "India", "base_price": 12000000},
    {"name": "Alex Carey", "role": "wicketkeeper", "country": "Australia", "base_price": 6000000},
]

for p in players_data:
    p["auction_id"] = auction.id
    db.add(Player(**p))

# --- Teams ---
teams_data = [
    {"name": "Mumbai Indians", "short_name": "MI", "total_budget": 100000000, "max_players": 18},
    {"name": "Chennai Super Kings", "short_name": "CSK", "total_budget": 100000000, "max_players": 18},
    {"name": "Royal Challengers Bangalore", "short_name": "RCB", "total_budget": 100000000, "max_players": 18},
    {"name": "Kolkata Knight Riders", "short_name": "KKR", "total_budget": 100000000, "max_players": 18},
    {"name": "Delhi Capitals", "short_name": "DC", "total_budget": 100000000, "max_players": 18},
    {"name": "Punjab Kings", "short_name": "PBKS", "total_budget": 100000000, "max_players": 18},
    {"name": "Rajasthan Royals", "short_name": "RR", "total_budget": 100000000, "max_players": 18},
    {"name": "Sunrisers Hyderabad", "short_name": "SRH", "total_budget": 100000000, "max_players": 18},
]

for t in teams_data:
    t["auction_id"] = auction.id
    t["remaining_budget"] = t["total_budget"]
    db.add(Team(**t))

db.commit()

# --- Bid Increment Slabs (IPL-style) ---
slabs_data = [
    {"min_price": 0, "max_price": 5000000, "increment": 1000000},
    {"min_price": 5000000, "max_price": 10000000, "increment": 2500000},
    {"min_price": 10000000, "max_price": 50000000, "increment": 2500000},
    {"min_price": 50000000, "max_price": 100000000, "increment": 5000000},
    {"min_price": 100000000, "max_price": 999999999, "increment": 10000000},
]

for s in slabs_data:
    s["auction_id"] = auction.id
    db.add(BidIncrementSlab(**s))

db.commit()

print(f"Seeded {len(players_data)} players, {len(teams_data)} teams, and {len(slabs_data)} bid slabs")
print(f"Auction created (id={auction.id})")

db.close()
