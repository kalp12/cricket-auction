import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from db.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test_auction.db"
engine = create_engine(TEST_DATABASE_URL, 
                       connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, 
                                   autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)

# ── AUTH ──────────────────────────────────────────────
def get_admin_token():
    r = client.post("/api/auth/login", 
                    data={"username": "admin", "password": "1234"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

def auth_headers():
    return {"Authorization": f"Bearer {get_admin_token()}"}

def test_login_success():
    r = client.post("/api/auth/login",
                    data={"username": "admin", "password": "1234"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password():
    r = client.post("/api/auth/login",
                    data={"username": "admin", "password": "wrong"})
    assert r.status_code in [400, 401]

def test_login_missing_fields():
    r = client.post("/api/auth/login", data={})
    assert r.status_code == 422

# ── PLAYERS ──────────────────────────────────────────
def create_test_player(name="Virat Kohli"):
    return client.post("/api/players/", json={
        "name": name,
        "role": "batsman",
        "country": "India",
        "base_price": 200.0,
        "image_url": None
    }, headers=auth_headers())

def test_create_player():
    r = create_test_player("Rohit Sharma")
    assert r.status_code in [200, 201], f"Failed: {r.text}"
    data = r.json()
    assert data["name"] == "Rohit Sharma"
    assert data["role"] == "batsman"
    assert data["status"] == "unsold"

def test_create_player_missing_fields():
    r = client.post("/api/players/", json={"name": "Test"},
                    headers=auth_headers())
    assert r.status_code == 422

def test_get_all_players():
    create_test_player("MS Dhoni")
    r = client.get("/api/players/", headers=auth_headers())
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_player_by_id():
    r = create_test_player("Bumrah")
    player_id = r.json()["id"]
    r2 = client.get(f"/api/players/{player_id}", headers=auth_headers())
    assert r2.status_code == 200
    assert r2.json()["id"] == player_id

def test_get_nonexistent_player():
    r = client.get("/api/players/99999", headers=auth_headers())
    assert r.status_code == 404

# ── TEAMS ────────────────────────────────────────────
def create_test_team(name="Mumbai Indians"):
    return client.post("/api/teams/", json={
        "name": name,
        "total_budget": 1000.0,
        "remaining_budget": 1000.0,
        "max_players": 15,
        "logo_url": None
    }, headers=auth_headers())

def test_create_team():
    r = create_test_team("Chennai Super Kings")
    assert r.status_code in [200, 201], f"Failed: {r.text}"
    data = r.json()
    assert data["name"] == "Chennai Super Kings"
    assert data["total_budget"] == 1000.0

def test_create_team_missing_fields():
    r = client.post("/api/teams/", json={"name": "Test"},
                    headers=auth_headers())
    assert r.status_code == 422

def test_get_all_teams():
    create_test_team("Kolkata Knight Riders")
    r = client.get("/api/teams/", headers=auth_headers())
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_team_by_id():
    r = create_test_team("Delhi Capitals")
    team_id = r.json()["id"]
    r2 = client.get(f"/api/teams/{team_id}", headers=auth_headers())
    assert r2.status_code == 200
    assert r2.json()["id"] == team_id

def test_get_nonexistent_team():
    r = client.get("/api/teams/99999", headers=auth_headers())
    assert r.status_code == 404

# ── AUCTION ──────────────────────────────────────────
def create_test_auction():
    return client.post("/api/auction/", json={},
                       headers=auth_headers())

def test_create_auction():
    r = create_test_auction()
    assert r.status_code in [200, 201], f"Failed: {r.text}"

def test_get_auction():
    r = create_test_auction()
    if r.status_code in [200, 201]:
        auction_id = r.json().get("id")
        if auction_id:
            r2 = client.get(f"/api/auction/{auction_id}",
                            headers=auth_headers())
            assert r2.status_code == 200

def test_get_nonexistent_auction():
    r = client.get("/api/auction/99999", headers=auth_headers())
    assert r.status_code == 404

# ── WEBSOCKET ────────────────────────────────────────
def test_websocket_invalid_auction():
    with client.websocket_connect("/ws/auction/99999") as ws:
        data = ws.receive_text()
        msg = __import__("json").loads(data)
        assert msg["type"] == "error"

def test_websocket_valid_auction():
    r = create_test_auction()
    if r.status_code not in [200, 201]:
        pytest.skip("Could not create auction")
    auction_id = r.json().get("id")
    if not auction_id:
        pytest.skip("No auction id returned")
    with client.websocket_connect(f"/ws/auction/{auction_id}") as ws:
        data = ws.receive_text()
        msg = __import__("json").loads(data)
        assert msg["type"] == "state"
        assert msg["auction_id"] == auction_id

def test_websocket_ping():
    r = create_test_auction()
    if r.status_code not in [200, 201]:
        pytest.skip("Could not create auction")
    auction_id = r.json().get("id")
    if not auction_id:
        pytest.skip("No auction id returned")
    with client.websocket_connect(f"/ws/auction/{auction_id}") as ws:
        ws.receive_text()  # consume initial state
        ws.send_text(__import__("json").dumps({"type": "ping"}))
        data = ws.receive_text()
        msg = __import__("json").loads(data)
        assert msg["type"] == "pong"

def test_websocket_bid_on_non_live_auction():
    r = create_test_auction()
    if r.status_code not in [200, 201]:
        pytest.skip("Could not create auction")
    auction_id = r.json().get("id")
    if not auction_id:
        pytest.skip("No auction id returned")
    with client.websocket_connect(f"/ws/auction/{auction_id}") as ws:
        ws.receive_text()  # consume state
        ws.send_text(__import__("json").dumps({
            "type": "bid",
            "team_id": 1,
            "amount": 100
        }))
        data = ws.receive_text()
        msg = __import__("json").loads(data)
        assert msg["type"] == "error"
        assert "not live" in msg["message"]

# ── ROOT ─────────────────────────────────────────────
def test_root():
    r = client.get("/")
    assert r.status_code == 200

def test_docs_available():
    r = client.get("/docs")
    assert r.status_code == 200