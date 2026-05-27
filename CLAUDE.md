# CLAUDE.md

## Project Overview
Full-stack cricket auction website with real-time bidding, user management, and player data management.

# Project Rules

## Think Before Coding
- State assumptions explicitly.
- Ask questions when requirements are unclear.

## Simplicity First
- Prefer the simplest solution.
- Avoid unnecessary abstractions.

## Surgical Changes
- Only modify files related to the task.
- Do not refactor unrelated code.

## Goal-Driven Execution
- Define success criteria.
- Run tests before claiming completion.

## Code Quality
- Follow existing project patterns.
- Reuse existing code before creating new abstractions.
- Explain tradeoffs when there are multiple valid approaches.

## Honesty
- Do not claim something was tested unless it was actually tested.
- Do not claim a bug is fixed without verification.

## Tech Stack
- **Frontend**: React 19 + Tailwind CSS 3 + TypeScript
- **Backend**: Python + FastAPI (REST API + WebSocket)
- **Database**: PostgreSQL 16 with SQLAlchemy ORM
- **Auth**: JWT (python-jose + passlib/bcrypt)
- **Real-time**: WebSocket (FastAPI built-in)

## Development Commands
```bash
# Backend
cd server && ./venv/Scripts/python.exe -m uvicorn main:app --reload  # port 8000

# Frontend
cd client && npm start  # port 3000

# Seed database
cd server && ./venv/Scripts/python.exe seed.py

# Tests (backend) — uses in-memory SQLite
cd server && ./venv/Scripts/python.exe -m pytest test/test_auction.py -v
```

## Architecture

### Backend (`server/`)

**Models**: `models/models.py` — Player, Team, TeamPlayer, Auction, Bid with relationships.

**Auth**: `auth/auth.py` — JWT creation/verification, `get_current_user` dependency. Login endpoint in `routes/auth.py`. No `auth/jwt.py` — always import from `auth.auth`.

**Routes** (`routes/`):
- `auth.py` — login, me
- `player.py` — player CRUD, bulk create
- `team.py` — team CRUD, budget
- `auction.py` — auction flow (start, bid, sold, unsold, pause, resume, state, history, rtm-accept, rtm-decline)
- `auctions.py` — auction CRUD, next-player
- `stats.py` — auction analytics
- `import_players.py` — bulk player import with column mapping
- `stats_import.py` — external stats import with fuzzy matching + versioning
- `export.py` — xlsx/csv export (players, results, rosters)
- `registration.py` — player self-registration
- `bids.py` — WebSocket endpoint `/ws/auction/{auction_id}` (per-auction rooms)
- `report.py` — post-auction report (summary, rosters, bid activity, RTM events)
- `public.py` — spectator mode (budget tiers, no exact amounts)
- `bonus_auction.py` — sealed bid, Dutch auction, proxy bidding endpoints

**WebSocket**: Only `bids.py` `ConnectionManager` is active. `websocket/manager.py` and `routes/ws.py` are unused — do not use them.

**Schemas**: `schemas/auction.py` is active. `schemas/auctions.py` and `schemas/bids.py` are unused.

### Frontend (`client/`)

React 19 + React Router + Tailwind CSS + lucide-react. API calls in `api.ts` (axios). WebSocket at `ws://localhost:8000/ws/auction/{auction_id}`.

### Database

PostgreSQL 16 at `localhost:5432/cricket_auction`. Auto-created on startup. Players: status (unsold/sold/pending) + cricket stats columns. Auctions: status (waiting/live/paused/ended). Seed: `python seed.py` (35 players, 8 IPL teams).

## Key Rules
- FastAPI + Pydantic for all request/response validation
- SQLAlchemy ORM only — never raw SQL (except seed.py TRUNCATE)
- JWT auth via `auth/auth.py` — import `get_current_user` from there
- Real-time bidding via WebSocket in `routes/bids.py`
- Never commit `.env`
- Commit to git after every major feature
- Auction start endpoint takes `player_id` and `timer_seconds` as query params, not JSON body

## Environment
- OS: Windows 11
- PostgreSQL 16 on localhost:5432, user: postgres, db: cricket_auction
- Shell: PowerShell (`&&` for chaining)
- `.env` in `server/` holds ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY, DATABASE_URL

## Remaining Features
- [ ] **Live Match Scoring**: Integrate real-time cricket match scores
- [ ] **Live Match Preview**: Embed YouTube live stream alongside auction room
- [ ] **Player Valuation Engine**: AI-driven base price suggestion
- [ ] **Payment Integration**: Track real payments, UPI/card links
- [ ] **Mobile App**: React Native or PWA wrapper
- [x] **Bonus Auction Types**: Sealed bid, Dutch auction, proxy bidding
- [ ] **Cloud Deployment**: Docker + docker-compose, AWS/GCP hosting
