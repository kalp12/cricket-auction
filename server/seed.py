"""Seed the database with dummy cricket players and teams."""
import sys
sys.path.insert(0, '.')

from db.database import SessionLocal, engine, Base
import models.models  # noqa: F401 - register models
from models.models import Player, Team, Auction, Bid, TeamPlayer, BidIncrementSlab

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Clear existing data and reset auto-increment
from sqlalchemy import text
db.execute(text("TRUNCATE TABLE bids, team_players, bid_increment_slabs, auctions, players, teams RESTART IDENTITY CASCADE"))
db.commit()

# Create auction first
auction = Auction(name="IPL Demo Auction", status="waiting", current_bid=0, timer_seconds=60,
                  timer_mode="auto", base_bid=1000000, budget_per_team=100000000,
                  min_players=5, max_players=18)
db.add(auction)
db.flush()

# --- Players (with cricket stats) ---
players_data = [
    # Batsmen
    {"name": "Virat Kohli", "role": "batsman", "country": "India", "base_price": 20000000,
     "matches": 274, "runs": 13848, "wickets": 4, "batting_avg": 57.7, "batting_sr": 131.3, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Rohit Sharma", "role": "batsman", "country": "India", "base_price": 18000000,
     "matches": 243, "runs": 11157, "wickets": 15, "batting_avg": 48.5, "batting_sr": 130.6, "bowling_avg": 32.0, "bowling_econ": 8.2},
    {"name": "Steve Smith", "role": "batsman", "country": "Australia", "base_price": 15000000,
     "matches": 103, "runs": 2485, "wickets": 1, "batting_avg": 35.5, "batting_sr": 128.1, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Joe Root", "role": "batsman", "country": "England", "base_price": 12000000,
     "matches": 15, "runs": 280, "wickets": 0, "batting_avg": 23.3, "batting_sr": 118.6, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Kane Williamson", "role": "batsman", "country": "New Zealand", "base_price": 15000000,
     "matches": 76, "runs": 2186, "wickets": 6, "batting_avg": 31.9, "batting_sr": 124.5, "bowling_avg": 28.0, "bowling_econ": 7.8},
    {"name": "Babar Azam", "role": "batsman", "country": "Pakistan", "base_price": 14000000,
     "matches": 55, "runs": 1705, "wickets": 0, "batting_avg": 35.5, "batting_sr": 125.2, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "David Warner", "role": "batsman", "country": "Australia", "base_price": 12000000,
     "matches": 176, "runs": 6398, "wickets": 4, "batting_avg": 41.5, "batting_sr": 139.7, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Shubman Gill", "role": "batsman", "country": "India", "base_price": 10000000,
     "matches": 91, "runs": 2790, "wickets": 0, "batting_avg": 35.6, "batting_sr": 133.4, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Travis Head", "role": "batsman", "country": "Australia", "base_price": 8000000,
     "matches": 21, "runs": 410, "wickets": 2, "batting_avg": 23.9, "batting_sr": 138.2, "bowling_avg": 35.0, "bowling_econ": 8.5},
    {"name": "Ruturaj Gaikwad", "role": "batsman", "country": "India", "base_price": 6000000,
     "matches": 52, "runs": 1797, "wickets": 0, "batting_avg": 37.4, "batting_sr": 133.4, "bowling_avg": 0, "bowling_econ": 0},
    # Bowlers
    {"name": "Jasprit Bumrah", "role": "bowler", "country": "India", "base_price": 18000000,
     "matches": 120, "runs": 66, "wickets": 145, "batting_avg": 6.6, "batting_sr": 108.2, "bowling_avg": 23.1, "bowling_econ": 7.4},
    {"name": "Pat Cummins", "role": "bowler", "country": "Australia", "base_price": 15000000,
     "matches": 42, "runs": 122, "wickets": 45, "batting_avg": 14.8, "batting_sr": 118.4, "bowling_avg": 25.6, "bowling_econ": 8.3},
    {"name": "Shaheen Afridi", "role": "bowler", "country": "Pakistan", "base_price": 12000000,
     "matches": 20, "runs": 30, "wickets": 23, "batting_avg": 10.0, "batting_sr": 96.8, "bowling_avg": 22.3, "bowling_econ": 7.8},
    {"name": "Trent Boult", "role": "bowler", "country": "New Zealand", "base_price": 10000000,
     "matches": 98, "runs": 76, "wickets": 121, "batting_avg": 6.3, "batting_sr": 103.5, "bowling_avg": 26.5, "bowling_econ": 8.4},
    {"name": "Kagiso Rabada", "role": "bowler", "country": "South Africa", "base_price": 12000000,
     "matches": 69, "runs": 71, "wickets": 93, "batting_avg": 9.1, "batting_sr": 114.5, "bowling_avg": 23.9, "bowling_econ": 8.2},
    {"name": "Rashid Khan", "role": "bowler", "country": "Afghanistan", "base_price": 14000000,
     "matches": 116, "runs": 382, "wickets": 132, "batting_avg": 16.6, "batting_sr": 142.5, "bowling_avg": 19.8, "bowling_econ": 6.5},
    {"name": "Josh Hazlewood", "role": "bowler", "country": "Australia", "base_price": 8000000,
     "matches": 38, "runs": 22, "wickets": 44, "batting_avg": 5.5, "batting_sr": 75.9, "bowling_avg": 24.5, "bowling_econ": 8.1},
    {"name": "Mohammed Shami", "role": "bowler", "country": "India", "base_price": 8000000,
     "matches": 93, "runs": 116, "wickets": 119, "batting_avg": 8.9, "batting_sr": 125.0, "bowling_avg": 27.3, "bowling_econ": 8.6},
    {"name": "Mark Wood", "role": "bowler", "country": "England", "base_price": 6000000,
     "matches": 15, "runs": 20, "wickets": 18, "batting_avg": 10.0, "batting_sr": 111.1, "bowling_avg": 23.1, "bowling_econ": 8.5},
    {"name": "Yuzvendra Chahal", "role": "bowler", "country": "India", "base_price": 4000000,
     "matches": 145, "runs": 58, "wickets": 166, "batting_avg": 4.1, "batting_sr": 77.3, "bowling_avg": 22.3, "bowling_econ": 7.6},
    # All-rounders
    {"name": "Ben Stokes", "role": "allrounder", "country": "England", "base_price": 16000000,
     "matches": 45, "runs": 892, "wickets": 28, "batting_avg": 25.5, "batting_sr": 132.9, "bowling_avg": 30.5, "bowling_econ": 8.7},
    {"name": "Ravindra Jadeja", "role": "allrounder", "country": "India", "base_price": 14000000,
     "matches": 210, "runs": 2692, "wickets": 152, "batting_avg": 26.1, "batting_sr": 128.5, "bowling_avg": 27.6, "bowling_econ": 7.5},
    {"name": "Shakib Al Hasan", "role": "allrounder", "country": "Bangladesh", "base_price": 10000000,
     "matches": 71, "runs": 793, "wickets": 63, "batting_avg": 19.3, "batting_sr": 124.3, "bowling_avg": 26.5, "bowling_econ": 7.2},
    {"name": "Cameron Green", "role": "allrounder", "country": "Australia", "base_price": 10000000,
     "matches": 25, "runs": 442, "wickets": 8, "batting_avg": 29.5, "batting_sr": 144.4, "bowling_avg": 38.0, "bowling_econ": 9.1},
    {"name": "Hardik Pandya", "role": "allrounder", "country": "India", "base_price": 15000000,
     "matches": 117, "runs": 1768, "wickets": 64, "batting_avg": 27.6, "batting_sr": 145.4, "bowling_avg": 32.8, "bowling_econ": 8.6},
    {"name": "Marco Jansen", "role": "allrounder", "country": "South Africa", "base_price": 6000000,
     "matches": 19, "runs": 142, "wickets": 16, "batting_avg": 22.3, "batting_sr": 136.5, "bowling_avg": 30.4, "bowling_econ": 8.8},
    {"name": "Sam Curran", "role": "allrounder", "country": "England", "base_price": 10000000,
     "matches": 30, "runs": 310, "wickets": 30, "batting_avg": 22.1, "batting_sr": 138.4, "bowling_avg": 27.8, "bowling_econ": 8.5},
    {"name": "Ravichandran Ashwin", "role": "allrounder", "country": "India", "base_price": 8000000,
     "matches": 97, "runs": 612, "wickets": 114, "batting_avg": 13.8, "batting_sr": 106.6, "bowling_avg": 24.8, "bowling_econ": 6.9},
    {"name": "Mitchell Marsh", "role": "allrounder", "country": "Australia", "base_price": 6000000,
     "matches": 59, "runs": 816, "wickets": 18, "batting_avg": 22.1, "batting_sr": 133.6, "bowling_avg": 35.2, "bowling_econ": 8.9},
    {"name": "Dwayne Bravo", "role": "allrounder", "country": "West Indies", "base_price": 4000000,
     "matches": 161, "runs": 1560, "wickets": 183, "batting_avg": 16.1, "batting_sr": 122.8, "bowling_avg": 24.2, "bowling_econ": 8.3},
    # Wicketkeepers
    {"name": "MS Dhoni", "role": "wicketkeeper", "country": "India", "base_price": 15000000,
     "matches": 250, "runs": 5082, "wickets": 0, "batting_avg": 38.8, "batting_sr": 135.1, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Quinton de Kock", "role": "wicketkeeper", "country": "South Africa", "base_price": 10000000,
     "matches": 86, "runs": 2512, "wickets": 0, "batting_avg": 32.2, "batting_sr": 137.9, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Jos Buttler", "role": "wicketkeeper", "country": "England", "base_price": 14000000,
     "matches": 82, "runs": 2856, "wickets": 0, "batting_avg": 40.2, "batting_sr": 149.5, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Rishabh Pant", "role": "wicketkeeper", "country": "India", "base_price": 12000000,
     "matches": 98, "runs": 2838, "wickets": 0, "batting_avg": 34.6, "batting_sr": 147.9, "bowling_avg": 0, "bowling_econ": 0},
    {"name": "Alex Carey", "role": "wicketkeeper", "country": "Australia", "base_price": 6000000,
     "matches": 12, "runs": 206, "wickets": 0, "batting_avg": 22.9, "batting_sr": 121.2, "bowling_avg": 0, "bowling_econ": 0},
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
