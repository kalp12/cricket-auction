import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys

sys.path.insert(0, '.')

from db.database import Base, get_db
from models.models import Player, Auction, Team, TeamPlayer, Bid  # noqa: F401
from auth.auth import get_current_user, create_access_token

# In-memory SQLite for tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


fake_user = type("User", (), {"username": "admin", "role": "admin"})()

from main import app  # noqa: E402

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = lambda: fake_user

client = TestClient(app)

# Shared auction ID for tests
AUCTION_ID = 1


def _auth_headers():
    return {"Authorization": "Bearer test-token"}


def _seed_auction():
    """Create the initial auction record."""
    db = TestSessionLocal()
    if not db.query(Auction).first():
        auction = Auction(id=AUCTION_ID, status="waiting", current_bid=0, timer_seconds=60, timer_mode="auto")
        db.add(auction)
        db.commit()
    db.close()


def _reset_auction():
    """Reset auction to waiting state."""
    db = TestSessionLocal()
    auction = db.query(Auction).first()
    if auction:
        auction.status = "waiting"
        auction.current_player_id = None
        auction.current_bid = 0
        auction.current_team_id = None
        db.commit()
    db.close()


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Cricket Auction" in response.json()["message"]


def test_login_fail_wrong_user():
    response = client.post(
        "/api/auth/login",
        data={"username": "wrong", "password": "wrong"}
    )
    assert response.status_code == 401


def test_create_player():
    _seed_auction()
    response = client.post(
        "/api/players",
        json={"auction_id": AUCTION_ID, "name": "Test Player", "role": "batsman", "country": "India", "base_price": 100000},
        headers=_auth_headers()
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Test Player"
    assert response.json()["status"] == "unsold"


def test_get_players():
    _seed_auction()
    response = client.get("/api/players", params={"auction_id": AUCTION_ID}, headers=_auth_headers())
    assert response.status_code == 200
    assert response.json()["total"] >= 1


def test_create_team():
    _seed_auction()
    response = client.post(
        "/api/teams",
        json={"auction_id": AUCTION_ID, "name": "Test Team", "total_budget": 10000000, "max_players": 15},
        headers=_auth_headers()
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Test Team"
    assert response.json()["remaining_budget"] == 10000000


def test_start_auction():
    _seed_auction()
    _reset_auction()
    player_res = client.post("/api/players",
        json={"auction_id": AUCTION_ID, "name": "Auction Player", "role": "allrounder", "country": "India", "base_price": 200000},
        headers=_auth_headers()
    )
    player_id = player_res.json()["id"]

    response = client.post("/api/auction/start",
        params={"player_id": player_id, "timer_seconds": 60},
        headers=_auth_headers()
    )
    assert response.status_code == 200
    assert response.json()["status"] == "live"
    assert response.json()["current_player_id"] == player_id


def test_place_bid():
    _seed_auction()
    _reset_auction()
    player_res = client.post("/api/players",
        json={"auction_id": AUCTION_ID, "name": "Bid Player", "role": "batsman", "country": "India", "base_price": 100000},
        headers=_auth_headers()
    )
    team_res = client.post("/api/teams",
        json={"auction_id": AUCTION_ID, "name": "Bid Team", "total_budget": 5000000},
        headers=_auth_headers()
    )
    player_id = player_res.json()["id"]
    team_id = team_res.json()["id"]

    client.post("/api/auction/start",
        params={"player_id": player_id, "timer_seconds": 60},
        headers=_auth_headers()
    )

    bid_res = client.post("/api/auction/bid",
        json={"team_id": team_id, "amount": 150000},
        headers=_auth_headers()
    )
    assert bid_res.status_code == 200
    assert bid_res.json()["current_bid"] == 150000


def test_mark_sold():
    _seed_auction()
    _reset_auction()
    player_res = client.post("/api/players",
        json={"auction_id": AUCTION_ID, "name": "Sold Player", "role": "bowler", "country": "England", "base_price": 100000},
        headers=_auth_headers()
    )
    team_res = client.post("/api/teams",
        json={"auction_id": AUCTION_ID, "name": "Sold Team", "total_budget": 5000000},
        headers=_auth_headers()
    )
    player_id = player_res.json()["id"]
    team_id = team_res.json()["id"]

    client.post("/api/auction/start",
        params={"player_id": player_id, "timer_seconds": 60},
        headers=_auth_headers()
    )
    client.post("/api/auction/bid",
        json={"team_id": team_id, "amount": 200000},
        headers=_auth_headers()
    )

    sold_res = client.post("/api/auction/sold",
        params={"auction_id": AUCTION_ID},
        headers=_auth_headers()
    )
    assert sold_res.status_code == 200
    assert "sold" in sold_res.json()["message"].lower()


def test_mark_unsold():
    _seed_auction()
    _reset_auction()
    player_res = client.post("/api/players",
        json={"auction_id": AUCTION_ID, "name": "Unsold Player", "role": "wicketkeeper", "country": "India", "base_price": 100000},
        headers=_auth_headers()
    )
    player_id = player_res.json()["id"]

    client.post("/api/auction/start",
        params={"player_id": player_id, "timer_seconds": 60},
        headers=_auth_headers()
    )

    unsold_res = client.post("/api/auction/unsold",
        params={"auction_id": AUCTION_ID},
        headers=_auth_headers()
    )
    assert unsold_res.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
