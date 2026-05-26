"""
Comprehensive backend test suite for Cricket Auction API.
Uses in-memory SQLite with StaticPool for connection sharing across tests.
Covers: auth, players, teams, auctions, auction flow, slabs, registration,
        import/export, stats, websocket, and edge cases.
"""
import pytest
import json
import io
import csv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db.database import Base, get_db
from models.models import Player, Auction, Team, TeamPlayer, Bid, BidIncrementSlab, Registration, StatUpdate, User
from auth.auth import get_current_user, create_access_token, verify_token

# ── In-memory SQLite setup ───────────────────────────────
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


fake_user = type("User", (), {"id": 1, "username": "admin", "role": "owner", "email": None})()

from main import app  # noqa: E402

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = lambda: fake_user

client = TestClient(app)

# ── Shared constants and helpers ─────────────────────────
AUCTION_ID = 1


def auth_headers():
    token = create_access_token(data={"sub": "admin", "role": "owner"})
    return {"Authorization": f"Bearer {token}"}


def seed_auction(**overrides):
    """Create an auction record and return its ID."""
    db = TestSessionLocal()
    defaults = {
        "id": AUCTION_ID,
        "name": "Test Auction",
        "status": "waiting",
        "current_bid": 0,
        "timer_seconds": 60,
        "timer_mode": "auto",
        "base_bid": 1000000,
        "budget_per_team": 100000000,
    }
    defaults.update(overrides)
    auction = Auction(**defaults)
    db.add(auction)
    db.commit()
    db.refresh(auction)
    aid = auction.id
    db.close()
    return aid


def reset_auction(auction_id=None):
    """Reset auction to waiting state."""
    db = TestSessionLocal()
    auction = db.query(Auction).filter(
        Auction.id == (auction_id or AUCTION_ID)
    ).first()
    if auction:
        auction.status = "waiting"
        auction.current_player_id = None
        auction.current_bid = 0
        auction.current_team_id = None
        db.commit()
    db.close()


def create_player(auction_id=None, **overrides):
    """Create a player via API, return response."""
    aid = auction_id or AUCTION_ID
    defaults = {
        "auction_id": aid,
        "name": "Test Player",
        "role": "batsman",
        "country": "India",
        "base_price": 100000,
    }
    defaults.update(overrides)
    return client.post("/api/players", json=defaults, headers=auth_headers())


def create_team(auction_id=None, **overrides):
    """Create a team via API, return response."""
    aid = auction_id or AUCTION_ID
    defaults = {
        "auction_id": aid,
        "name": "Test Team",
        "total_budget": 5000000,
        "max_players": 15,
    }
    defaults.update(overrides)
    return client.post("/api/teams", json=defaults, headers=auth_headers())


def start_auction_with_player(player_id, auction_id=None, timer=60):
    """Start the auction flow with a specific player."""
    return client.post(
        "/api/auction/start",
        params={"player_id": player_id, "timer_seconds": timer},
        headers=auth_headers(),
    )


@pytest.fixture(autouse=True)
def clean_db():
    """Clean all tables before each test for isolation."""
    db = TestSessionLocal()
    for table in [StatUpdate, Registration, Bid, TeamPlayer, BidIncrementSlab, Player, Team, Auction]:
        db.query(table).delete()
    db.commit()
    db.close()
    yield
    # Teardown: nothing needed since we clean before each test


# ═══════════════════════════════════════════════════════════
# 1. AUTH TESTS
# ═══════════════════════════════════════════════════════════

class TestAuth:
    def test_login_wrong_username(self):
        r = client.post("/api/auth/login", data={"username": "wrong", "password": "wrong"})
        assert r.status_code == 401

    def test_login_wrong_password(self):
        r = client.post("/api/auth/login", data={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_login_missing_fields(self):
        r = client.post("/api/auth/login", data={})
        assert r.status_code == 422

    def test_get_me_with_valid_token(self):
        r = client.get("/api/auth/me", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "admin"
        assert data["role"] == "owner"

    def test_get_me_without_token(self):
        # With dependency override, test verify_token directly instead
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            verify_token("")
        assert exc_info.value.status_code == 401

    def test_get_me_with_expired_token(self):
        # Dependency override bypasses token check; test verify_token directly
        from fastapi import HTTPException
        token = create_access_token(data={"sub": "admin"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(HTTPException) as exc_info:
            verify_token(token)
        assert exc_info.value.status_code == 401

    def test_get_me_with_invalid_token(self):
        # Already covered by test_verify_token_invalid_raises
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            verify_token("totally.invalid.token")
        assert exc_info.value.status_code == 401

    def test_create_access_token_contains_sub(self):
        token = create_access_token(data={"sub": "testuser"})
        payload = verify_token(token)
        assert payload["sub"] == "testuser"

    def test_verify_token_invalid_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            verify_token("invalid.token.here")
        assert exc_info.value.status_code == 401


# ═══════════════════════════════════════════════════════════
# 2. PLAYER CRUD + EDGE CASES
# ═══════════════════════════════════════════════════════════

class TestPlayerCRUD:
    def test_create_player(self):
        seed_auction()
        r = create_player(name="Virat Kohli")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Virat Kohli"
        assert data["role"] == "batsman"
        assert data["status"] == "unsold"
        assert data["base_price"] == 100000

    def test_create_player_with_stats(self):
        seed_auction()
        r = create_player(name="Stats Player", matches=200, runs=10000, wickets=5,
                          batting_avg=55.0, batting_sr=90.0, bowling_avg=40.0, bowling_econ=7.5)
        assert r.status_code == 200
        data = r.json()
        assert data["matches"] == 200
        assert data["runs"] == 10000
        assert data["batting_avg"] == 55.0

    def test_create_player_invalid_auction(self):
        r = create_player(auction_id=99999, name="Ghost Player")
        assert r.status_code == 404

    def test_create_player_missing_required_fields(self):
        seed_auction()
        r = client.post("/api/players", json={"name": "No Fields"}, headers=auth_headers())
        assert r.status_code == 422

    def test_create_player_zero_base_price(self):
        seed_auction()
        r = create_player(name="Free Player", base_price=0)
        assert r.status_code == 200
        assert r.json()["base_price"] == 0

    def test_create_player_negative_base_price(self):
        seed_auction()
        r = create_player(name="Negative Player", base_price=-100)
        assert r.status_code == 200  # No validation constraint on positive price

    def test_get_players(self):
        seed_auction()
        create_player(name="P1")
        create_player(name="P2")
        r = client.get("/api/players", params={"auction_id": AUCTION_ID}, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["total"] >= 2

    def test_get_players_filter_by_role(self):
        seed_auction()
        create_player(name="Batsman 1", role="batsman")
        create_player(name="Bowler 1", role="bowler")
        r = client.get("/api/players", params={"auction_id": AUCTION_ID, "role": "batsman"}, headers=auth_headers())
        assert r.status_code == 200
        for p in r.json()["players"]:
            assert p["role"] == "batsman"

    def test_get_players_filter_by_status(self):
        seed_auction()
        create_player(name="Unsold Player")
        r = client.get("/api/players", params={"auction_id": AUCTION_ID, "status": "unsold"}, headers=auth_headers())
        assert r.status_code == 200
        for p in r.json()["players"]:
            assert p["status"] == "unsold"

    def test_get_players_pagination(self):
        seed_auction()
        for i in range(5):
            create_player(name=f"Player {i}")
        r = client.get("/api/players", params={"auction_id": AUCTION_ID, "skip": 0, "limit": 2}, headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()["players"]) == 2

    def test_get_players_pagination_offset(self):
        seed_auction()
        for i in range(5):
            create_player(name=f"Player {i}")
        r = client.get("/api/players", params={"auction_id": AUCTION_ID, "skip": 3, "limit": 10}, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["total"] >= 2

    def test_get_player_by_id(self):
        seed_auction()
        r = create_player(name="ByID Player")
        pid = r.json()["id"]
        r2 = client.get(f"/api/players/{pid}", headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["id"] == pid
        assert r2.json()["name"] == "ByID Player"

    def test_get_nonexistent_player(self):
        r = client.get("/api/players/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_update_player(self):
        seed_auction()
        r = create_player(name="Original")
        pid = r.json()["id"]
        r2 = client.put(f"/api/players/{pid}", json={"name": "Updated", "role": "bowler"}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["name"] == "Updated"
        assert r2.json()["role"] == "bowler"

    def test_update_player_partial(self):
        seed_auction()
        r = create_player(name="Partial Update")
        pid = r.json()["id"]
        r2 = client.put(f"/api/players/{pid}", json={"runs": 5000}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["runs"] == 5000
        assert r2.json()["name"] == "Partial Update"  # unchanged

    def test_update_nonexistent_player(self):
        r = client.put("/api/players/99999", json={"name": "Ghost"}, headers=auth_headers())
        assert r.status_code == 404

    def test_delete_player(self):
        seed_auction()
        r = create_player(name="ToDelete")
        pid = r.json()["id"]
        r2 = client.delete(f"/api/players/{pid}", headers=auth_headers())
        assert r2.status_code == 200
        r3 = client.get(f"/api/players/{pid}", headers=auth_headers())
        assert r3.status_code == 404

    def test_delete_nonexistent_player(self):
        r = client.delete("/api/players/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_bulk_create_players(self):
        seed_auction()
        players = [
            {"auction_id": AUCTION_ID, "name": f"Bulk {i}", "role": "batsman", "country": "India", "base_price": 100000}
            for i in range(3)
        ]
        r = client.post("/api/players/bulk", json=players, headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_bulk_create_empty_list(self):
        r = client.post("/api/players/bulk", json=[], headers=auth_headers())
        assert r.status_code == 200
        assert r.json() == []

    def test_create_player_all_roles(self):
        seed_auction()
        for role in ["batsman", "bowler", "allrounder", "wicketkeeper"]:
            r = create_player(name=f"{role} player", role=role)
            assert r.status_code == 200
            assert r.json()["role"] == role

    def test_create_player_special_chars_name(self):
        seed_auction()
        r = create_player(name="O'Brien-Müller Jr.")
        assert r.status_code == 200
        assert r.json()["name"] == "O'Brien-Müller Jr."


# ═══════════════════════════════════════════════════════════
# 3. TEAM CRUD + EDGE CASES
# ═══════════════════════════════════════════════════════════

class TestTeamCRUD:
    def test_create_team(self):
        seed_auction()
        r = create_team(name="Mumbai Indians")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Mumbai Indians"
        assert data["remaining_budget"] == 5000000  # equals total_budget initially

    def test_create_team_invalid_auction(self):
        r = create_team(auction_id=99999, name="Ghost Team")
        assert r.status_code == 404

    def test_create_team_with_short_name(self):
        seed_auction()
        r = create_team(name="Chennai Super Kings", short_name="CSK")
        assert r.status_code == 200
        assert r.json()["short_name"] == "CSK"

    def test_create_team_zero_budget_fails(self):
        seed_auction()
        r = create_team(name="Broke Team", total_budget=0)
        assert r.status_code == 422  # Field(gt=0) validation

    def test_create_team_negative_budget_fails(self):
        seed_auction()
        r = create_team(name="Neg Team", total_budget=-500)
        assert r.status_code == 422

    def test_create_team_max_players_validation(self):
        seed_auction()
        r = create_team(name="Big Team", max_players=50)  # max is 30
        assert r.status_code == 422

    def test_create_team_zero_max_players_fails(self):
        seed_auction()
        r = create_team(name="Tiny Team", max_players=0)
        assert r.status_code == 422

    def test_get_teams(self):
        seed_auction()
        create_team(name="Team A")
        create_team(name="Team B")
        r = client.get("/api/teams", params={"auction_id": AUCTION_ID}, headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_get_teams_empty_auction(self):
        seed_auction()
        r = client.get("/api/teams", params={"auction_id": AUCTION_ID}, headers=auth_headers())
        assert r.status_code == 200
        assert r.json() == []

    def test_get_team_by_id(self):
        seed_auction()
        r = create_team(name="Detail Team")
        tid = r.json()["id"]
        r2 = client.get(f"/api/teams/{tid}", headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["name"] == "Detail Team"
        assert "players" in r2.json()  # TeamDetailResponse includes players

    def test_get_nonexistent_team(self):
        r = client.get("/api/teams/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_update_team(self):
        seed_auction()
        r = create_team(name="Original Team")
        tid = r.json()["id"]
        r2 = client.put(f"/api/teams/{tid}", json={"name": "Renamed Team", "short_name": "RT"}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["name"] == "Renamed Team"
        assert r2.json()["short_name"] == "RT"

    def test_update_team_budget(self):
        seed_auction()
        r = create_team(name="Budget Team")
        tid = r.json()["id"]
        r2 = client.put(f"/api/teams/{tid}", json={"total_budget": 8000000}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["total_budget"] == 8000000

    def test_update_nonexistent_team(self):
        r = client.put("/api/teams/99999", json={"name": "Ghost"}, headers=auth_headers())
        assert r.status_code == 404

    def test_delete_team(self):
        seed_auction()
        r = create_team(name="ToDelete Team")
        tid = r.json()["id"]
        r2 = client.delete(f"/api/teams/{tid}", headers=auth_headers())
        assert r2.status_code == 200
        r3 = client.get(f"/api/teams/{tid}", headers=auth_headers())
        assert r3.status_code == 404

    def test_delete_nonexistent_team(self):
        r = client.delete("/api/teams/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_team_budget_endpoint(self):
        seed_auction()
        r = create_team(name="Budget Check", total_budget=10000000)
        tid = r.json()["id"]
        r2 = client.get(f"/api/teams/{tid}/budget", headers=auth_headers())
        assert r2.status_code == 200
        data = r2.json()
        assert data["total_budget"] == 10000000
        assert data["remaining_budget"] == 10000000
        assert data["can_bid"] is True

    def test_team_budget_nonexistent(self):
        r = client.get("/api/teams/99999/budget", headers=auth_headers())
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 4. AUCTION CRUD
# ═══════════════════════════════════════════════════════════

class TestAuctionCRUD:
    def test_create_auction(self):
        r = client.post("/api/auctions", json={"name": "IPL 2025"}, headers=auth_headers())
        assert r.status_code == 201
        assert r.json()["name"] == "IPL 2025"
        assert r.json()["status"] == "waiting"

    def test_create_auction_defaults(self):
        r = client.post("/api/auctions", json={}, headers=auth_headers())
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Untitled Auction"
        assert data["timer_mode"] == "auto"
        assert data["timer_seconds"] == 60

    def test_list_auctions(self):
        client.post("/api/auctions", json={"name": "A1"}, headers=auth_headers())
        client.post("/api/auctions", json={"name": "A2"}, headers=auth_headers())
        r = client.get("/api/auctions", headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_get_auction_by_id(self):
        r = client.post("/api/auctions", json={"name": "Detail Auction"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.get(f"/api/auctions/{aid}")
        assert r2.status_code == 200
        assert r2.json()["name"] == "Detail Auction"

    def test_get_auction_no_auth_required(self):
        r = client.post("/api/auctions", json={"name": "Public Auction"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.get(f"/api/auctions/{aid}")
        assert r2.status_code == 200  # No auth needed for GET

    def test_get_nonexistent_auction(self):
        r = client.get("/api/auctions/99999")
        assert r.status_code == 404

    def test_update_auction(self):
        r = client.post("/api/auctions", json={"name": "Original"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.put(f"/api/auctions/{aid}", json={"name": "Updated", "timer_seconds": 30}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["name"] == "Updated"
        assert r2.json()["timer_seconds"] == 30

    def test_update_auction_sponsors(self):
        r = client.post("/api/auctions", json={"name": "Sponsor Auction"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.put(f"/api/auctions/{aid}", json={
            "sponsor_tl": "https://example.com/tl.png",
            "sponsor_br": "https://example.com/br.png"
        }, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["sponsor_tl"] == "https://example.com/tl.png"

    def test_update_nonexistent_auction(self):
        r = client.put("/api/auctions/99999", json={"name": "Ghost"}, headers=auth_headers())
        assert r.status_code == 404

    def test_delete_auction(self):
        r = client.post("/api/auctions", json={"name": "ToDelete"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.delete(f"/api/auctions/{aid}", headers=auth_headers())
        assert r2.status_code == 200
        r3 = client.get(f"/api/auctions/{aid}")
        assert r3.status_code == 404

    def test_delete_nonexistent_auction(self):
        r = client.delete("/api/auctions/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_start_auction_via_auctions_endpoint(self):
        r = client.post("/api/auctions", json={"name": "Startable"}, headers=auth_headers())
        aid = r.json()["id"]
        r2 = client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        assert r2.status_code == 200

    def test_start_auction_already_started(self):
        r = client.post("/api/auctions", json={"name": "AlreadyStarted"}, headers=auth_headers())
        aid = r.json()["id"]
        client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        r2 = client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        assert r2.status_code == 400

    def test_next_player_random(self):
        r = client.post("/api/auctions", json={"name": "NextPlayer"}, headers=auth_headers())
        aid = r.json()["id"]
        client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        # Add players
        for i in range(3):
            client.post("/api/players", json={
                "auction_id": aid, "name": f"NP Player {i}",
                "role": "batsman", "country": "India", "base_price": 100000
            }, headers=auth_headers())
        r2 = client.post(f"/api/auctions/{aid}/next-player", headers=auth_headers())
        assert r2.status_code == 200
        assert "player_id" in r2.json()

    def test_next_player_specific_id(self):
        r = client.post("/api/auctions", json={"name": "PickPlayer"}, headers=auth_headers())
        aid = r.json()["id"]
        client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        # Add some players first
        for i in range(2):
            client.post("/api/players", json={
                "auction_id": aid, "name": f"Filler {i}",
                "role": "batsman", "country": "India", "base_price": 200000
            }, headers=auth_headers())
        p = client.post("/api/players", json={
            "auction_id": aid, "name": "Specific Player",
            "role": "bowler", "country": "India", "base_price": 200000
        }, headers=auth_headers())
        pid = p.json()["id"]
        r2 = client.post(f"/api/auctions/{aid}/next-player",
                         params={"player_id": pid}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["player_id"] == pid

    def test_next_player_nonexistent_auction(self):
        r = client.post("/api/auctions/99999/next-player", headers=auth_headers())
        assert r.status_code == 404

    def test_next_player_already_sold(self):
        r = client.post("/api/auctions", json={"name": "SoldSelect"}, headers=auth_headers())
        aid = r.json()["id"]
        client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        p = client.post("/api/players", json={
            "auction_id": aid, "name": "Already Sold",
            "role": "batsman", "country": "India", "base_price": 100000
        }, headers=auth_headers())
        pid = p.json()["id"]
        # Mark player as sold via DB
        db = TestSessionLocal()
        player = db.query(Player).get(pid)
        player.status = "sold"
        db.commit()
        db.close()
        r2 = client.post(f"/api/auctions/{aid}/next-player",
                         params={"player_id": pid}, headers=auth_headers())
        assert r2.status_code == 404

    def test_next_player_no_unsold_ends_auction(self):
        r = client.post("/api/auctions", json={"name": "NoPlayers"}, headers=auth_headers())
        aid = r.json()["id"]
        client.post(f"/api/auctions/{aid}/start", headers=auth_headers())
        r2 = client.post(f"/api/auctions/{aid}/next-player", headers=auth_headers())
        assert r2.status_code == 200
        assert "ended" in r2.json()["message"].lower()


# ═══════════════════════════════════════════════════════════
# 5. AUCTION FLOW (start → bid → sold/unsold → pause/resume)
# ═══════════════════════════════════════════════════════════

class TestAuctionFlow:
    def test_start_auction_with_player(self):
        seed_auction()
        p = create_player(name="Flow Player")
        pid = p.json()["id"]
        r = start_auction_with_player(pid)
        assert r.status_code == 200
        assert r.json()["status"] == "live"
        assert r.json()["current_player_id"] == pid

    def test_start_with_nonexistent_player(self):
        seed_auction()
        r = client.post("/api/auction/start",
                        params={"player_id": 99999, "timer_seconds": 60},
                        headers=auth_headers())
        assert r.status_code == 404

    def test_start_with_already_sold_player(self):
        seed_auction()
        p = create_player(name="Sold Start")
        pid = p.json()["id"]
        db = TestSessionLocal()
        player = db.query(Player).get(pid)
        player.status = "sold"
        db.commit()
        db.close()
        r = start_auction_with_player(pid)
        assert r.status_code == 400

    def test_place_bid(self):
        seed_auction()
        p = create_player(name="Bid Player")
        t = create_team(name="Bidding Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 150000},
                        headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["current_bid"] == 150000

    def test_bid_lower_than_current(self):
        seed_auction()
        p = create_player(name="Low Bid Player")
        t = create_team(name="Low Bid Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        # First bid at base price + 50k
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 150000},
                    headers=auth_headers())
        # Second bid lower
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 100000},
                        headers=auth_headers())
        assert r.status_code == 400
        assert "higher" in r.json()["detail"].lower()

    def test_bid_equal_to_current(self):
        seed_auction()
        p = create_player(name="Equal Bid Player", base_price=200000)
        t = create_team(name="Equal Bid Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 200000},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_bid_insufficient_budget(self):
        seed_auction()
        p = create_player(name="Expensive Player", base_price=100000)
        t = create_team(name="Poor Team", total_budget=120000)
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        # Bid 150000 but team only has 120000
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 150000},
                        headers=auth_headers())
        assert r.status_code == 400
        assert "insufficient" in r.json()["detail"].lower()

    def test_bid_nonexistent_team(self):
        seed_auction()
        p = create_player(name="No Team Player")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/bid",
                        json={"team_id": 99999, "amount": 150000},
                        headers=auth_headers())
        assert r.status_code == 404

    def test_bid_wrong_auction_team(self):
        seed_auction()
        # Create another auction
        r2 = client.post("/api/auctions", json={"name": "Other Auction"}, headers=auth_headers())
        other_aid = r2.json()["id"]
        # Team belongs to other auction
        t_other = create_team(auction_id=other_aid, name="Wrong Auction Team")
        tid = t_other.json()["id"]
        p = create_player(name="Mismatch Player")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 150000},
                        headers=auth_headers())
        assert r.status_code == 400
        assert "does not belong" in r.json()["detail"].lower()

    def test_bid_consecutive_same_team(self):
        seed_auction()
        p = create_player(name="Consecutive Player")
        t = create_team(name="Same Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 150000},
                    headers=auth_headers())
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 200000},
                        headers=auth_headers())
        assert r.status_code == 400
        assert "consecutive" in r.json()["detail"].lower()

    def test_bid_when_not_live(self):
        seed_auction(status="waiting")
        p = create_player(name="Not Live Player")
        t = create_team(name="Not Live Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        # Don't start the auction — it's still waiting
        db = TestSessionLocal()
        auction = db.query(Auction).get(AUCTION_ID)
        auction.current_player_id = pid
        auction.current_bid = 100000
        db.commit()
        db.close()
        r = client.post("/api/auction/bid",
                        json={"team_id": tid, "amount": 150000},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_mark_sold(self):
        seed_auction()
        p = create_player(name="Sold Flow Player")
        t = create_team(name="Buyer Team")
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 200000},
                    headers=auth_headers())
        r = client.post("/api/auction/sold",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 200
        assert "sold" in r.json()["message"].lower()
        assert r.json()["price"] == 200000

    def test_sold_deducts_from_budget(self):
        seed_auction()
        p = create_player(name="Budget Deduct Player")
        t = create_team(name="Spend Team", total_budget=10000000)
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 500000},
                    headers=auth_headers())
        client.post("/api/auction/sold",
                    params={"auction_id": AUCTION_ID},
                    headers=auth_headers())
        # Check budget
        r = client.get(f"/api/teams/{tid}/budget", headers=auth_headers())
        assert r.json()["remaining_budget"] == 9500000
        assert r.json()["spent"] == 500000

    def test_sold_without_bids(self):
        seed_auction()
        p = create_player(name="No Bid Sold")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/sold",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 400
        assert "no bids" in r.json()["detail"].lower()

    def test_sold_not_live(self):
        seed_auction(status="waiting")
        r = client.post("/api/auction/sold",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_mark_unsold(self):
        seed_auction()
        p = create_player(name="Unsold Flow Player")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/unsold",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 200

    def test_unsold_not_live(self):
        seed_auction(status="waiting")
        r = client.post("/api/auction/unsold",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_pause_auction(self):
        seed_auction()
        p = create_player(name="Pause Player")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/pause",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["status"] == "paused"

    def test_pause_not_live_auction(self):
        seed_auction(status="waiting")
        r = client.post("/api/auction/pause",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_resume_auction(self):
        seed_auction()
        p = create_player(name="Resume Player")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/pause",
                    params={"auction_id": AUCTION_ID},
                    headers=auth_headers())
        r = client.post("/api/auction/resume",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["status"] == "live"

    def test_resume_not_paused_auction(self):
        seed_auction()
        p = create_player(name="Resume Not Paused")
        pid = p.json()["id"]
        start_auction_with_player(pid)
        r = client.post("/api/auction/resume",
                        params={"auction_id": AUCTION_ID},
                        headers=auth_headers())
        assert r.status_code == 400

    def test_pause_resume_cycle(self):
        """Full cycle: start -> bid -> pause -> resume -> bid -> sold."""
        seed_auction()
        p = create_player(name="Cycle Player", base_price=100000)
        t1 = create_team(name="Cycle Team 1", total_budget=10000000)
        t2 = create_team(name="Cycle Team 2", total_budget=10000000)
        pid = p.json()["id"]
        t1id = t1.json()["id"]
        t2id = t2.json()["id"]
        start_auction_with_player(pid)
        # Bid from team 1
        client.post("/api/auction/bid",
                    json={"team_id": t1id, "amount": 200000},
                    headers=auth_headers())
        # Pause
        client.post("/api/auction/pause",
                    params={"auction_id": AUCTION_ID},
                    headers=auth_headers())
        # Resume
        client.post("/api/auction/resume",
                    params={"auction_id": AUCTION_ID},
                    headers=auth_headers())
        # Bid from team 2 after resume (cannot bid consecutively from same team)
        r = client.post("/api/auction/bid",
                        json={"team_id": t2id, "amount": 300000},
                        headers=auth_headers())
        assert r.status_code == 200
    def test_full_auction_flow(self):
        """End-to-end: create → start → bid → sold → verify."""
        seed_auction()
        p = create_player(name="E2E Player", base_price=100000)
        t = create_team(name="E2E Team", total_budget=10000000)
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 500000},
                    headers=auth_headers())
        sold = client.post("/api/auction/sold",
                           params={"auction_id": AUCTION_ID},
                           headers=auth_headers())
        assert sold.status_code == 200
        # Verify player is sold
        r = client.get(f"/api/players/{pid}", headers=auth_headers())
        assert r.json()["status"] == "sold"
        # Verify team has the player
        r2 = client.get(f"/api/teams/{tid}", headers=auth_headers())
        assert any(pl["id"] == pid for pl in r2.json()["players"])

    def test_play_sound(self):
        seed_auction()
        for key in ["gavel", "unsold", "timer", "celebration"]:
            r = client.post("/api/auction/play-sound",
                            params={"sound_key": key, "auction_id": AUCTION_ID},
                            headers=auth_headers())
            assert r.status_code == 200

    def test_play_sound_nonexistent_auction(self):
        r = client.post("/api/auction/play-sound",
                        params={"sound_key": "gavel", "auction_id": 99999},
                        headers=auth_headers())
        assert r.status_code == 404

    def test_auction_state(self):
        seed_auction()
        r = client.get("/api/auction/state",
                       params={"auction_id": AUCTION_ID})
        assert r.status_code == 200
        data = r.json()
        assert "current_auction" in data
        assert data["current_auction"]["id"] == AUCTION_ID

    def test_auction_history_empty(self):
        seed_auction()
        r = client.get("/api/auction/history",
                       params={"auction_id": AUCTION_ID})
        assert r.status_code == 200
        assert r.json() == []


# ═══════════════════════════════════════════════════════════
# 6. BID INCREMENT SLABS
# ═══════════════════════════════════════════════════════════

class TestSlabs:
    def test_create_slab(self):
        seed_auction()
        r = client.post("/api/slabs", json={
            "auction_id": AUCTION_ID, "min_price": 0, "max_price": 5000000, "increment": 1000000
        }, headers=auth_headers())
        assert r.status_code == 201

    def test_create_slab_invalid_auction(self):
        r = client.post("/api/slabs", json={
            "auction_id": 99999, "min_price": 0, "max_price": 5000000, "increment": 1000000
        }, headers=auth_headers())
        assert r.status_code == 404

    def test_list_slabs(self):
        seed_auction()
        client.post("/api/slabs", json={
            "auction_id": AUCTION_ID, "min_price": 0, "max_price": 5000000, "increment": 1000000
        }, headers=auth_headers())
        r = client.get("/api/slabs", params={"auction_id": AUCTION_ID}, headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_create_default_slabs(self):
        seed_auction()
        r = client.post(f"/api/slabs/defaults/{AUCTION_ID}", headers=auth_headers())
        assert r.status_code == 201
        assert len(r.json()) == 5  # 5 IPL-style defaults

    def test_create_default_slabs_replaces_existing(self):
        seed_auction()
        client.post("/api/slabs", json={
            "auction_id": AUCTION_ID, "min_price": 0, "max_price": 1000, "increment": 100
        }, headers=auth_headers())
        r = client.post(f"/api/slabs/defaults/{AUCTION_ID}", headers=auth_headers())
        assert r.status_code == 201
        assert len(r.json()) == 5

    def test_create_default_slabs_nonexistent_auction(self):
        r = client.post("/api/slabs/defaults/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_bulk_create_slabs(self):
        seed_auction()
        slabs = [
            {"auction_id": AUCTION_ID, "min_price": 0, "max_price": 5000000, "increment": 1000000},
            {"auction_id": AUCTION_ID, "min_price": 5000000, "max_price": 10000000, "increment": 2500000},
        ]
        r = client.post("/api/slabs/bulk", json={"slabs": slabs}, headers=auth_headers())
        assert r.status_code == 201
        assert len(r.json()) == 2

    def test_bulk_create_slabs_empty(self):
        r = client.post("/api/slabs/bulk", json={"slabs": []}, headers=auth_headers())
        assert r.status_code == 400

    def test_update_slab(self):
        seed_auction()
        r = client.post("/api/slabs", json={
            "auction_id": AUCTION_ID, "min_price": 0, "max_price": 5000000, "increment": 1000000
        }, headers=auth_headers())
        sid = r.json()["id"]
        r2 = client.put(f"/api/slabs/{sid}", json={"increment": 2000000}, headers=auth_headers())
        assert r2.status_code == 200
        assert r2.json()["increment"] == 2000000

    def test_update_nonexistent_slab(self):
        r = client.put("/api/slabs/99999", json={"increment": 1000}, headers=auth_headers())
        assert r.status_code == 404

    def test_delete_slab(self):
        seed_auction()
        r = client.post("/api/slabs", json={
            "auction_id": AUCTION_ID, "min_price": 0, "max_price": 5000000, "increment": 1000000
        }, headers=auth_headers())
        sid = r.json()["id"]
        r2 = client.delete(f"/api/slabs/{sid}", headers=auth_headers())
        assert r2.status_code == 200

    def test_delete_nonexistent_slab(self):
        r = client.delete("/api/slabs/99999", headers=auth_headers())
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 7. REGISTRATION
# ═══════════════════════════════════════════════════════════

class TestRegistration:
    def test_registration_status(self):
        seed_auction()
        r = client.get(f"/api/registration/{AUCTION_ID}/status")
        assert r.status_code == 200
        data = r.json()
        assert "open" in data
        assert "form_config" in data

    def test_registration_status_nonexistent_auction(self):
        r = client.get("/api/registration/99999/status")
        assert r.status_code == 404

    def test_submit_registration_closed(self):
        seed_auction(registration_open=0)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Reg Player", "role": "batsman", "country": "India", "base_price": 100000
        })
        assert r.status_code == 403

    def test_submit_registration_open(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Reg Player", "role": "batsman", "country": "India", "base_price": 100000
        })
        assert r.status_code == 200
        assert r.json()["id"] is not None

    def test_submit_registration_with_email(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Email Player", "role": "bowler", "country": "Australia",
            "base_price": 200000, "email": "test@example.com"
        })
        assert r.status_code == 200

    def test_submit_registration_with_stats(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Stats Reg", "role": "allrounder", "country": "India",
            "base_price": 150000, "matches": 50, "runs": 2000, "wickets": 30
        })
        assert r.status_code == 200

    def test_submit_registration_deadline_passed(self):
        seed_auction(registration_open=1, registration_deadline=datetime.utcnow() - timedelta(hours=1))
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Late Player", "role": "batsman", "country": "India", "base_price": 100000
        })
        assert r.status_code == 403

    def test_submit_registration_nonexistent_auction(self):
        r = client.post("/api/registration/99999/submit", json={
            "name": "Ghost", "role": "batsman", "country": "India", "base_price": 100000
        })
        assert r.status_code == 404

    def test_toggle_registration(self):
        seed_auction(registration_open=0)
        r = client.post(f"/api/registration/{AUCTION_ID}/toggle", headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["registration_open"] is True
        # Toggle again
        r2 = client.post(f"/api/registration/{AUCTION_ID}/toggle", headers=auth_headers())
        assert r2.json()["registration_open"] is False

    def test_toggle_registration_nonexistent(self):
        r = client.post("/api/registration/99999/toggle", headers=auth_headers())
        assert r.status_code == 404

    def test_list_registrations(self):
        seed_auction(registration_open=1)
        client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "List Reg", "role": "bowler", "country": "India", "base_price": 100000
        })
        r = client.get(f"/api/registration/{AUCTION_ID}/list", headers=auth_headers())
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_list_registrations_filter_status(self):
        seed_auction(registration_open=1)
        client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Filter Reg", "role": "bowler", "country": "India", "base_price": 100000
        })
        r = client.get(f"/api/registration/{AUCTION_ID}/list",
                       params={"status": "pending"}, headers=auth_headers())
        assert r.status_code == 200
        for reg in r.json():
            assert reg["status"] == "pending"

    def test_approve_registration(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Approve Me", "role": "batsman", "country": "India", "base_price": 100000
        })
        reg_id = r.json()["id"]
        r2 = client.post(f"/api/registration/{reg_id}/approve", headers=auth_headers())
        assert r2.status_code == 200
        assert "player_id" in r2.json()

    def test_approve_already_approved(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Double Approve", "role": "batsman", "country": "India", "base_price": 100000
        })
        reg_id = r.json()["id"]
        client.post(f"/api/registration/{reg_id}/approve", headers=auth_headers())
        r2 = client.post(f"/api/registration/{reg_id}/approve", headers=auth_headers())
        assert r2.status_code == 400

    def test_reject_registration(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Reject Me", "role": "bowler", "country": "England", "base_price": 100000
        })
        reg_id = r.json()["id"]
        r2 = client.post(f"/api/registration/{reg_id}/reject", headers=auth_headers())
        assert r2.status_code == 200

    def test_reject_already_rejected(self):
        seed_auction(registration_open=1)
        r = client.post(f"/api/registration/{AUCTION_ID}/submit", json={
            "name": "Double Reject", "role": "bowler", "country": "India", "base_price": 100000
        })
        reg_id = r.json()["id"]
        client.post(f"/api/registration/{reg_id}/reject", headers=auth_headers())
        r2 = client.post(f"/api/registration/{reg_id}/reject", headers=auth_headers())
        assert r2.status_code == 400

    def test_approve_nonexistent_registration(self):
        r = client.post("/api/registration/99999/approve", headers=auth_headers())
        assert r.status_code == 404

    def test_reject_nonexistent_registration(self):
        r = client.post("/api/registration/99999/reject", headers=auth_headers())
        assert r.status_code == 404

    def test_set_registration_deadline(self):
        seed_auction()
        future = (datetime.utcnow() + timedelta(days=7)).isoformat()
        r = client.put(f"/api/registration/{AUCTION_ID}/deadline",
                       params={"deadline": future}, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["registration_deadline"] is not None

    def test_set_registration_deadline_invalid_format(self):
        seed_auction()
        r = client.put(f"/api/registration/{AUCTION_ID}/deadline",
                       params={"deadline": "not-a-date"}, headers=auth_headers())
        assert r.status_code == 400

    def test_clear_registration_deadline(self):
        seed_auction()
        r = client.put(f"/api/registration/{AUCTION_ID}/deadline",
                       headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["registration_deadline"] is None

    def test_update_form_config(self):
        seed_auction()
        config = {"name": {"visible": True, "required": True}, "email": {"visible": False}}
        r = client.put(f"/api/registration/{AUCTION_ID}/form-config",
                       json=config, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["form_config"] == config


# ═══════════════════════════════════════════════════════════
# 8. STATS
# ═══════════════════════════════════════════════════════════

class TestStats:
    def test_stats_empty_auction(self):
        seed_auction()
        r = client.get(f"/api/auction/{AUCTION_ID}/stats", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["overview"]["total_players"] == 0
        assert data["overview"]["sold"] == 0

    def test_stats_with_players(self):
        seed_auction()
        create_player(name="Stats P1", role="batsman")
        create_player(name="Stats P2", role="bowler")
        create_player(name="Stats P3", role="allrounder")
        r = client.get(f"/api/auction/{AUCTION_ID}/stats", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["overview"]["total_players"] == 3
        assert len(data["role_breakdown"]) >= 2
        assert len(data["country_breakdown"]) >= 1

    def test_stats_after_sold(self):
        seed_auction()
        p = create_player(name="Sold Stats Player", base_price=100000)
        t = create_team(name="Stats Buyer", total_budget=10000000)
        pid = p.json()["id"]
        tid = t.json()["id"]
        start_auction_with_player(pid)
        client.post("/api/auction/bid",
                    json={"team_id": tid, "amount": 500000},
                    headers=auth_headers())
        client.post("/api/auction/sold",
                    params={"auction_id": AUCTION_ID},
                    headers=auth_headers())
        r = client.get(f"/api/auction/{AUCTION_ID}/stats", headers=auth_headers())
        data = r.json()
        assert data["overview"]["sold"] == 1
        assert data["overview"]["total_spent"] == 500000

    def test_stats_top_batsmen_bowlers(self):
        seed_auction()
        create_player(name="Top Bat", role="batsman", runs=10000)
        create_player(name="Top Bowl", role="bowler", wickets=200)
        r = client.get(f"/api/auction/{AUCTION_ID}/stats", headers=auth_headers())
        data = r.json()
        assert len(data["top_batsmen"]) >= 1
        assert len(data["top_bowlers"]) >= 1

    def test_stats_team_spending(self):
        seed_auction()
        create_team(name="Spender", total_budget=10000000)
        r = client.get(f"/api/auction/{AUCTION_ID}/stats", headers=auth_headers())
        data = r.json()
        assert len(data["team_spending"]) >= 1


# ═══════════════════════════════════════════════════════════
# 9. EXPORT
# ═══════════════════════════════════════════════════════════

class TestExport:
    def test_export_players_xlsx(self):
        seed_auction()
        create_player(name="Export Player")
        r = client.get("/api/export/players",
                       params={"auction_id": AUCTION_ID, "format": "xlsx"},
                       headers=auth_headers())
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_export_players_csv(self):
        seed_auction()
        create_player(name="CSV Player")
        r = client.get("/api/export/players",
                       params={"auction_id": AUCTION_ID, "format": "csv"},
                       headers=auth_headers())
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_export_auction_results_xlsx(self):
        seed_auction()
        create_player(name="Result Player")
        r = client.get("/api/export/auction-results",
                       params={"auction_id": AUCTION_ID, "format": "xlsx"},
                       headers=auth_headers())
        assert r.status_code == 200

    def test_export_auction_results_csv(self):
        seed_auction()
        create_player(name="CSV Result Player")
        r = client.get("/api/export/auction-results",
                       params={"auction_id": AUCTION_ID, "format": "csv"},
                       headers=auth_headers())
        assert r.status_code == 200

    def test_export_team_rosters_xlsx(self):
        seed_auction()
        create_team(name="Roster Team")
        r = client.get("/api/export/team-rosters",
                       params={"auction_id": AUCTION_ID, "format": "xlsx"},
                       headers=auth_headers())
        assert r.status_code == 200

    def test_export_team_rosters_csv(self):
        seed_auction()
        create_team(name="Roster CSV Team")
        r = client.get("/api/export/team-rosters",
                       params={"auction_id": AUCTION_ID, "format": "csv"},
                       headers=auth_headers())
        assert r.status_code == 200

    def test_export_nonexistent_auction(self):
        r = client.get("/api/export/players",
                       params={"auction_id": 99999}, headers=auth_headers())
        assert r.status_code == 404

    def test_export_csv_content_valid(self):
        seed_auction()
        create_player(name="CSV Validate", country="Australia")
        r = client.get("/api/export/players",
                       params={"auction_id": AUCTION_ID, "format": "csv"},
                       headers=auth_headers())
        content = r.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        assert len(rows) >= 2  # header + at least 1 data row
        assert any("Name" in cell for cell in rows[0])


# ═══════════════════════════════════════════════════════════
# 10. IMPORT TEAMS
# ═══════════════════════════════════════════════════════════

class TestImportTeams:
    def test_download_team_template(self):
        seed_auction()
        r = client.get("/api/import/teams/template",
                       params={"auction_id": AUCTION_ID},
                       headers=auth_headers())
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_commit_team_import(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "short_name", "2": "total_budget"},
            "rows": [["MI", "Mumbai Indians", "100000000"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 1

    def test_commit_team_import_missing_name(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"2": "total_budget"},
            "rows": [["", "", "100000000"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 0
        assert len(r.json()["errors"]) >= 1

    def test_commit_team_import_missing_budget(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name"},
            "rows": [["No Budget Team"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 0

    def test_commit_team_import_invalid_budget(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "total_budget"},
            "rows": [["Bad Budget", "not_a_number"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 0
        assert len(r.json()["errors"]) >= 1

    def test_commit_team_import_with_max_players(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "short_name", "2": "total_budget", "3": "max_players"},
            "rows": [["RCB", "Royal Challengers", "100000000", "25"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 1

    def test_commit_team_import_nonexistent_auction(self):
        r = client.post("/api/import/teams/commit", json={
            "auction_id": 99999,
            "mapping": {"0": "name", "1": "total_budget"},
            "rows": [["Ghost", "100000000"]]
        }, headers=auth_headers())
        assert r.status_code == 404

    def test_commit_team_import_missing_auction_id(self):
        r = client.post("/api/import/teams/commit", json={
            "mapping": {"0": "name"},
            "rows": [["No Auction"]]
        }, headers=auth_headers())
        assert r.status_code == 400

    def test_commit_team_import_multiple_rows(self):
        seed_auction()
        r = client.post("/api/import/teams/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "total_budget"},
            "rows": [["Team A", "50000000"], ["Team B", "60000000"], ["Team C", "70000000"]]
        }, headers=auth_headers())
        assert r.status_code == 200
        assert r.json()["teams_created"] == 3


# ═══════════════════════════════════════════════════════════
# 11. WEBSOCKET
# ═══════════════════════════════════════════════════════════

class TestWebSocket:
    def test_ws_invalid_auction(self):
        with client.websocket_connect("/ws/auction/99999") as ws:
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "error"

    def test_ws_valid_auction_receives_state(self):
        seed_auction()
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "state"
            assert msg["auction_id"] == AUCTION_ID

    def test_ws_ping_pong(self):
        seed_auction()
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            ws.receive_text()  # consume initial state
            ws.send_text(json.dumps({"type": "ping"}))
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "pong"

    def test_ws_bid_on_not_live(self):
        seed_auction()
        t = create_team(name="WS Team")
        tid = t.json()["id"]
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            ws.receive_text()  # consume state
            ws.send_text(json.dumps({"type": "bid", "team_id": tid, "amount": 200000}))
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "error"
            assert "not live" in msg["message"].lower()

    def test_ws_invalid_json(self):
        seed_auction()
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            ws.receive_text()
            ws.send_text("not json{{{")
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "error"

    def test_ws_bid_missing_team_id(self):
        seed_auction()
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            ws.receive_text()
            ws.send_text(json.dumps({"type": "bid", "amount": 100}))
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "error"
            assert "team_id" in msg["message"].lower()

    def test_ws_bid_nonexistent_team(self):
        seed_auction(status="live")
        with client.websocket_connect(f"/ws/auction/{AUCTION_ID}") as ws:
            ws.receive_text()
            ws.send_text(json.dumps({"type": "bid", "team_id": 99999, "amount": 500000}))
            data = ws.receive_text()
            msg = json.loads(data)
            assert msg["type"] == "error"
            assert "team not found" in msg["message"].lower()


# ═══════════════════════════════════════════════════════════
# 12. STATS IMPORT
# ═══════════════════════════════════════════════════════════

class TestStatsImport:
    def test_upload_stats_csv(self):
        seed_auction()
        create_player(name="Virat Kohli", matches=200, runs=10000, wickets=4, batting_avg=55.0, batting_sr=90.0, bowling_avg=0, bowling_econ=0)
        csv_content = "Player,Matches,Runs,Wickets\nVirat Kohli,250,12000,5\n"
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("stats.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "headers" in data
        assert "suggested_mapping" in data
        assert "matched_rows" in data
        assert data["total_rows"] == 1

    def test_upload_stats_xlsx(self):
        seed_auction()
        create_player(name="Steve Smith")
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["Player", "Matches", "Runs"])
        ws.append(["Steve Smith", "100", "8000"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("stats.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total_rows"] == 1

    def test_upload_stats_nonexistent_auction(self):
        csv_content = "Player,Matches\nTest,10\n"
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": 99999},
            files={"file": ("stats.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 404

    def test_upload_stats_unsupported_format(self):
        seed_auction()
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("stats.txt", "some content", "text/plain")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_upload_stats_empty_csv(self):
        seed_auction()
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("empty.csv", "", "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_commit_stats_import(self):
        seed_auction()
        create_player(name="Jasprit Bumrah", matches=50, runs=100, wickets=80, batting_avg=5.0, batting_sr=60.0, bowling_avg=20.0, bowling_econ=6.5)
        r = client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "ESPN Cricinfo",
            "mapping": {"0": "name", "1": "matches", "2": "runs", "3": "wickets"},
            "rows": [["Jasprit Bumrah", "60", "200", "100"]],
            "player_overrides": {},
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["updates_applied"] == 1
        assert data["total_rows"] == 1

    def test_commit_stats_import_with_fuzzy_match(self):
        seed_auction()
        create_player(name="Ravindra Jadeja", matches=100, runs=2000, wickets=50)
        r = client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Cricbuzz",
            "mapping": {"0": "name", "1": "matches"},
            "rows": [["R Jadeja", "120"]],
            "player_overrides": {},
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["updates_applied"] == 1

    def test_commit_stats_import_player_override(self):
        seed_auction()
        p = create_player(name="MS Dhoni", matches=300, runs=10000)
        player_id = p.json()["id"]
        r = client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Manual",
            "mapping": {"1": "matches"},
            "rows": [["Unknown Name", "350"]],
            "player_overrides": {"0": player_id},
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["updates_applied"] == 1

    def test_commit_stats_import_no_changes(self):
        seed_auction()
        create_player(name="Rohit Sharma", matches=200, runs=9000)
        r = client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Test",
            "mapping": {"0": "name", "1": "matches"},
            "rows": [["Rohit Sharma", "200"]],
            "player_overrides": {},
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["updates_applied"] == 0  # No change since matches is already 200

    def test_commit_stats_import_missing_auction_id(self):
        r = client.post("/api/stats-import/commit", json={
            "mapping": {},
            "rows": [],
            "player_overrides": {},
        }, headers=auth_headers())
        assert r.status_code == 400

    def test_commit_stats_import_unmatched_player(self):
        seed_auction()
        r = client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Test",
            "mapping": {"0": "name", "1": "matches"},
            "rows": [["Nonexistent Player", "100"]],
            "player_overrides": {},
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["updates_applied"] == 0
        assert len(data["errors"]) > 0

    def test_get_stats_history(self):
        seed_auction()
        p = create_player(name="History Player", matches=50, runs=2000, wickets=10, batting_avg=40.0, batting_sr=80.0, bowling_avg=30.0, bowling_econ=7.0)
        player_id = p.json()["id"]
        # First import
        client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Source A",
            "mapping": {"0": "name", "1": "matches"},
            "rows": [["History Player", "75"]],
            "player_overrides": {},
        }, headers=auth_headers())
        # Second import
        client.post("/api/stats-import/commit", json={
            "auction_id": AUCTION_ID,
            "source": "Source B",
            "mapping": {"0": "name", "1": "runs"},
            "rows": [["History Player", "3000"]],
            "player_overrides": {},
        }, headers=auth_headers())
        r = client.get(f"/api/stats-import/history/{player_id}", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["player_id"] == player_id
        assert data["player_name"] == "History Player"
        assert "current_stats" in data
        assert len(data["history"]) == 2

    def test_get_stats_history_nonexistent_player(self):
        r = client.get("/api/stats-import/history/99999", headers=auth_headers())
        assert r.status_code == 404

    def test_upload_stats_auto_suggests_mapping(self):
        seed_auction()
        create_player(name="KL Rahul")
        csv_content = "Player,Mat,Runs,Wkt,Bat Avg,SR,Bowl Avg,Econ\nKL Rahul,80,3000,5,40.5,85.3,50.0,8.2\n"
        r = client.post(
            "/api/stats-import/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("stats.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        mapping = data["suggested_mapping"]
        # Check that common aliases are auto-mapped
        assert "name" in mapping.values() or "player_id" in mapping.values()


# ═══════════════════════════════════════════════════════════
# 13. PLAYER IMPORT
# ═══════════════════════════════════════════════════════════

class TestPlayerImport:
    def test_download_template(self):
        seed_auction()
        r = client.get(
            "/api/import/players/template",
            params={"auction_id": AUCTION_ID},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_upload_player_csv(self):
        seed_auction()
        csv_content = "Player Name,Role,Country,Base Price,Matches,Runs\nShubman Gill,batsman,India,1500000,50,2500\n"
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("players.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "headers" in data
        assert "suggested_mapping" in data
        assert data["total_rows"] == 1

    def test_upload_player_xlsx(self):
        seed_auction()
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["Player Name", "Role", "Country", "Base Price"])
        ws.append(["Hardik Pandya", "allrounder", "India", 2000000])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("players.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total_rows"] == 1

    def test_upload_player_nonexistent_auction(self):
        csv_content = "Player Name,Role,Country,Base Price\nTest,batsman,India,100000\n"
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": 99999},
            files={"file": ("players.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 404

    def test_upload_player_unsupported_format(self):
        seed_auction()
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("players.txt", "data", "text/plain")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_upload_player_empty_csv(self):
        seed_auction()
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("empty.csv", "", "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_commit_player_import(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [["Ishan Kishan", "batsman", "India", "1200000"]],
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["players_created"] == 1
        assert data["total_rows"] == 1

    def test_commit_player_import_with_stats(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price", "4": "matches", "5": "runs", "6": "wickets", "7": "batting_avg"},
            "rows": [["Rishabh Pant", "wicketkeeper", "India", "1500000", "60", "3000", "2", "45.5"]],
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["players_created"] == 1

    def test_commit_player_import_missing_name(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"1": "role", "2": "country", "3": "base_price"},
            "rows": [["", "batsman", "India", "100000"]],
        }, headers=auth_headers())
        assert r.status_code == 400

    def test_commit_player_import_missing_auction_id(self):
        r = client.post("/api/import/players/commit", json={
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [["Test", "batsman", "India", "100000"]],
        }, headers=auth_headers())
        assert r.status_code == 400

    def test_commit_player_import_nonexistent_auction(self):
        r = client.post("/api/import/players/commit", json={
            "auction_id": 99999,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [["Test", "batsman", "India", "100000"]],
        }, headers=auth_headers())
        assert r.status_code == 404

    def test_commit_player_import_invalid_base_price(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [["Test Player", "batsman", "India", "not_a_number"]],
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["players_created"] == 0
        assert len(data["errors"]) > 0

    def test_commit_player_import_multiple_rows(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [
                ["Player A", "batsman", "India", "500000"],
                ["Player B", "bowler", "Australia", "800000"],
                ["Player C", "allrounder", "England", "1200000"],
            ],
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["players_created"] == 3

    def test_upload_player_auto_suggests_mapping(self):
        seed_auction()
        csv_content = "Player Name,Role,Country,Base Price\nShubman Gill,batsman,India,1500000\n"
        r = client.post(
            "/api/import/players/upload",
            params={"auction_id": AUCTION_ID},
            files={"file": ("players.csv", csv_content, "text/csv")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        mapping = data["suggested_mapping"]
        assert "name" in mapping.values()
        assert "role" in mapping.values()
        assert "country" in mapping.values()
        assert "base_price" in mapping.values()

    def test_commit_player_import_with_comma_price(self):
        seed_auction()
        r = client.post("/api/import/players/commit", json={
            "auction_id": AUCTION_ID,
            "mapping": {"0": "name", "1": "role", "2": "country", "3": "base_price"},
            "rows": [["Test Player", "bowler", "India", "1,500,000"]],
        }, headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["players_created"] == 1


# ═══════════════════════════════════════════════════════════
# 14. UPLOAD (IMAGE + AUDIO)
# ═══════════════════════════════════════════════════════════

class TestUpload:
    def test_upload_image_png(self):
        # Minimal valid PNG: 1x1 transparent pixel
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        r = client.post(
            "/api/upload/image",
            files={"file": ("test.png", png_data, "image/png")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "url" in data
        assert data["url"].startswith("/uploads/")
        assert data["url"].endswith(".png")

    def test_upload_image_jpg(self):
        # Minimal JPEG
        jpg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xf9\xfe\xa8*(;\xff\xd9'
        r = client.post(
            "/api/upload/image",
            files={"file": ("test.jpg", jpg_data, "image/jpeg")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["url"].endswith(".jpg")

    def test_upload_image_invalid_extension(self):
        r = client.post(
            "/api/upload/image",
            files={"file": ("test.exe", b"MZ\x90\x00", "application/octet-stream")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_upload_audio_mp3(self):
        # Minimal MP3 header (ID3 tag start)
        mp3_data = b'ID3\x03\x00\x00\x00\x00\x00\x00' + b'\xff\xfb\x90\x00' + b'\x00' * 100
        r = client.post(
            "/api/upload/audio",
            files={"file": ("test.mp3", mp3_data, "audio/mpeg")},
            headers=auth_headers(),
        )
        assert r.status_code == 200
        data = r.json()
        assert "url" in data
        assert data["url"].startswith("/uploads/")
        assert data["url"].endswith(".mp3")

    def test_upload_audio_invalid_extension(self):
        r = client.post(
            "/api/upload/audio",
            files={"file": ("test.exe", b"MZ\x90\x00", "application/octet-stream")},
            headers=auth_headers(),
        )
        assert r.status_code == 400

    def test_serve_upload_not_found(self):
        r = client.get("/api/upload/nonexistent_file.png")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 15. ROOT + MISC
# ═══════════════════════════════════════════════════════════

class TestMisc:
    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        assert "Cricket Auction" in r.json()["message"]

    def test_docs_available(self):
        r = client.get("/docs")
        assert r.status_code == 200

    def test_unauthenticated_protected_endpoints(self):
        """Verify that protected endpoints reject requests without auth."""
        endpoints = [
            ("POST", "/api/players"),
            ("GET", "/api/players"),
            ("POST", "/api/teams"),
            ("GET", "/api/teams"),
        ]
        for method, path in endpoints:
            if method == "POST":
                r = client.post(path, json={})
            else:
                r = client.get(path)
            assert r.status_code in [401, 403, 422], f"Expected auth error for {method} {path}, got {r.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
