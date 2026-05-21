# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack cricket auction website with real-time bidding, user management, and player data management.

## Tech Stack

- **Frontend**: React 19 + Tailwind CSS 3 + TypeScript
- **Backend**: Python + FastAPI (REST API + WebSocket)
- **Database**: PostgreSQL 16 with SQLAlchemy ORM
- **Auth**: JWT (python-jose + passlib/bcrypt)
- **Real-time**: WebSocket (FastAPI built-in)

## Architecture

### Backend (`server/`)

**Single canonical models file**: `models/models.py` contains all ORM models (Player, Team, TeamPlayer, Auction, Bid) with relationships.

**Auth flow**: `auth/auth.py` handles JWT creation/verification and `get_current_user` dependency. The login endpoint is `routes/auth.py` (OAuth2PasswordRequestForm). There is no `auth/jwt.py` — always import from `auth.auth`.

**Route organization** (`routes/`):
- `auth.py` — POST `/api/auth/login`, GET `/api/auth/me`
- `player.py` — CRUD `/api/players`, bulk create `/api/players/bulk`
- `team.py` — CRUD `/api/teams`, budget endpoint `/api/teams/{id}/budget`
- `auction.py` — Auction flow: `/api/auction/start`, `/bid`, `/sold`, `/unsold`, `/pause`, `/resume`, `/state`, `/history`
- `auctions.py` — CRUD `/api/auctions`, `/auctions/{id}/start`, `/auctions/{id}/next-player`
- `stats.py` — GET `/api/auction/{id}/stats` (analytics: overview, role/country breakdown, top batsmen/bowlers, team spending, most expensive)
- `bids.py` — WebSocket endpoint `/ws/auction/{auction_id}` for real-time bidding

**WebSocket**: `bids.py` has its own `ConnectionManager` (per-auction rooms). The `websocket/manager.py` and `routes/ws.py` are a separate unused implementation — do not use them.

**Schemas**: `schemas/auction.py` is the active schema (AuctionResponse, AuctionStateResponse, BidCreate). `schemas/auctions.py` and `schemas/bids.py` are older/unused versions.

### Frontend (`client/`)

React 19 app with React Router, Tailwind CSS, lucide-react icons. API calls in `api.ts` using axios. WebSocket connects to `ws://localhost:8000/ws/auction/{auction_id}`.

**Pages** (`pages/`):
- `Login.tsx` — admin login form
- `Dashboard.tsx` — home with cards to create/view auctions
- `MyAuctions.tsx` — list all auctions with status badges
- `NewAuction.tsx` — create auction form with image upload
- `AuctionDetail.tsx` — single auction overview, edit, links to teams/players/settings/live
- `Teams.tsx` — team management (CRUD, budget bars, roster expand/collapse)
- `Players.tsx` — player management (CRUD, role/status/country filters, search)
- `Settings.tsx` — auction rules + bid increment slab editor
- `AuctionPanel.tsx` — auction picker (links to live room)
- `AuctionLive.tsx` — live auction room with WebSocket, keyboard bidding, timer circle, team sidebar, bid history, notifications, sold/unsold animations
- `AuctionHistory.tsx` — sold players list, team spending breakdown, search/filter
- `AuctionStats.tsx` — auction analytics: role/country breakdown, top batsmen/bowlers, team spending chart, most expensive sale, highest base prices
- `Auction.tsx` — legacy standalone auction page (not used in dashboard routes)

**Components** (`components/`):
- `DashboardLayout.tsx` — sidebar + outlet wrapper
- `Sidebar.tsx` — left nav with dashboard/auctions/auction panel links + logout

### Database

PostgreSQL 16 at `localhost:5432/cricket_auction`. Tables auto-created on startup via `Base.metadata.create_all`. Players have status: unsold/sold/pending and cricket stats columns (matches, runs, wickets, batting_avg, batting_sr, bowling_avg, bowling_econ). Auctions have status: waiting/live/paused/ended. TeamPlayer join table tracks purchases with `bought_price`.

**Seed script**: `python seed.py` — populates DB with 35 players and 8 IPL teams. Uses `TRUNCATE ... RESTART IDENTITY CASCADE` to reset IDs.

## Development Commands

```bash
# Backend
cd server && ./venv/Scripts/python.exe -m uvicorn main:app --reload   # port 8000

# Frontend
cd client && npm start                                                  # port 3000

# API docs
# http://localhost:8000/docs

# Seed database
cd server && ./venv/Scripts/python.exe seed.py

# Tests (backend) — uses in-memory SQLite, not PostgreSQL
cd server && ./venv/Scripts/python.exe -m pytest test/test_auction.py -v

# Tests (frontend)
cd client && npm test
```

## Key Rules

- FastAPI with Pydantic schemas for all request/response validation
- SQLAlchemy ORM only — never raw SQL (except in seed.py for TRUNCATE)
- JWT auth via `auth/auth.py` — import `get_current_user` from there, not `auth.jwt`
- Real-time bidding via WebSocket in `routes/bids.py`
- Never commit `.env`
- Commit to git after every major feature
- Never read `node_modules` or `__pycache__`
- Auction start endpoint takes `player_id` and `timer_seconds` as query params, not JSON body

## Environment

- OS: Windows 11
- PostgreSQL 16 on localhost:5432, user: postgres, db: cricket_auction
- Project root: forward slashes in file paths
- Shell: PowerShell (`&&` for chaining)
- `.env` file in `server/` holds ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY, DATABASE_URL

## Upcoming Features (Phase 2)

### Modern UI Overhaul
- [x] Redesign with modern design system (glassmorphism, gradients, micro-interactions)
- [x] Framer Motion for page transitions and component animations
- [x] Better typography and spacing system (Bebas Neue display, Outfit body, JetBrains Mono)
- [x] SOLD confetti fireworks + gavel animation + pulse ring overlay
- [x] Sponsor corner logos (4 positions) on auction live page + settings UI
- [x] Dark mode / light mode toggle
- [x] Responsive mobile-first design
- [x] Reusable component library (Button, Card, Input, Badge, Table, Modal)
- [x] Skeleton loading states (replace "Loading..." text)
- [x] Data visualization with charts (recharts) on Stats page
- [x] Empty states with illustrations (no players, no teams, no bids yet)
- [x] Toast notifications (react-hot-toast) instead of alert() calls
- [x] Command palette / quick search (cmd+k)

### Player Registration (Google Form-like)
- [ ] Public player registration page (no login required) — form with name, role, country, base_price, stats, photo upload
- [ ] Registration form shareable link per auction (e.g. /register/{auction_id})
- [ ] Admin approval workflow for registered players (pending → approved → added to pool)
- [ ] Customizable registration form (admin can toggle which fields are required)
- [ ] Registration deadline / cutoff timer
- [ ] Email confirmation on registration (optional)
- [ ] QR code generation for registration link

### Excel/CSV Import & Export
- [ ] Upload Excel/CSV file to bulk import players (map columns to player fields)
- [ ] Column mapping UI — drag/map uploaded column names to system fields
- [ ] Import preview table with validation errors highlighted before committing
- [ ] Export players to Excel/CSV (full data dump)
- [ ] Export auction results to Excel/CSV (sold/unsold, prices, team assignments)
- [ ] Export team rosters to Excel/CSV
- [ ] Support for .xlsx and .csv formats (openpyxl for Excel, pandas for parsing)
- [ ] Template download — admin downloads blank template with correct column headers

### External Stats Import
- [ ] Upload Excel/CSV with player cricket stats from external providers (ESPN Cricinfo, Cricbuzz, HowStat)
- [ ] Match stats by player name (fuzzy matching) or player ID
- [ ] Stats mapping UI — map uploaded columns to batting_avg, bowling_econ, etc.
- [ ] Import preview with diff view (showing old vs new stat values)
- [ ] Historical stats versioning — keep track of stat updates over time
- [ ] Support common external stat formats (ESPN Cricinfo export, Cricbuzz CSV)

## Future Scope (Advanced / Phase 3+)

- [ ] **Live Match Scoring**: Integrate real-time cricket match scores (CricAPI / ESPN Cricinfo API) — show player's current form during auction
- [ ] **Live Match Preview**: Embed YouTube live stream of the actual match alongside the auction room
- [ ] **Player Valuation Engine**: AI-driven base price suggestion based on career stats, recent form, T20 ranking
- [ ] **Multi-admin Support**: Multiple auctioneer accounts with different permissions (owner, editor, viewer)
- [ ] **Spectator Mode**: Read-only live auction view for audience (no login, no bidding controls)
- [ ] **OBS Overlay**: Browser-source compatible overlay for streaming auction on YouTube/Twitch
- [ ] **Auction Replays**: Record bid-by-bid timeline, playback the auction after it ends
- [ ] **Payment Integration**: Track real payments, UPI/card links for team owners
- [ ] **Mobile App**: React Native or PWA wrapper for mobile bidding
- [ ] **IPL-style RTM (Right to Match)**: Team can match the final bid for their released player
- [ ] **Bonus Auction Types**: Sealed bid, Dutch auction (price descends), proxy bidding
- [ ] **Post-Auction Reports**: Beautiful PDF/HTML report with team-wise summaries, charts, logo
- [ ] **Multi-sport Support**: Extend beyond cricket to football, kabaddi, etc.
- [ ] **Cloud Deployment**: Docker + docker-compose for one-click deploy, AWS/GCP hosting

## Completed

- [x] Database models (Player, Team, TeamPlayer, Auction, Bid)
- [x] PostgreSQL 16 database (migrated from SQLite)
- [x] JWT auth with admin login
- [x] Player CRUD API (create, list with filters, get, update, delete, bulk)
- [x] Team CRUD API with budget tracking
- [x] Auction flow API (start, bid, sold, unsold, pause, resume, state, history)
- [x] Auction CRUD API (create, get, start, next-player)
- [x] WebSocket real-time bidding (per-auction rooms)
- [x] Seed script with 35 players and 8 teams
- [x] Test suite (9 passing tests)
- [x] Login page frontend
- [x] Auction page frontend (basic live bidding)
- [x] API client (axios)
- [x] Dashboard with sidebar navigation
- [x] My Auctions page (list/grid with status badges)
- [x] New Auction page (form with image upload)
- [x] Auction Detail page (overview, edit, links to sub-pages)
- [x] Player Management page (CRUD, role/status/country filters, search)
- [x] Team Management page (CRUD, budget bars, roster expand/collapse)
- [x] Settings page (auction rules + bid increment slab editor)
- [x] Auction Panel (auction picker to enter live room)
- [x] Auction Live page (full dark-theme live room with WebSocket)
- [x] Keyboard shortcut bidding (team key auto-bids via WebSocket)
- [x] Configurable bid increment slabs (IPL-style price brackets)
- [x] Visual countdown timer (SVG circular progress, color changes)
- [x] Random player selection (next-player endpoint)
- [x] Auction History page (sold players, team spending, search/filter)
- [x] Desktop notifications (sold/unsold/timer-expired, browser Notification API with toggle)
- [x] Animations/transitions (sold/unsold flash overlay, player reveal, bid price bump, timer urgency pulse, card hover effects, page fade-in)
- [x] Player stats tracking (cricket stats on Player model, Stats page with analytics, Players table shows Mat/Runs/Wkts, seed data with realistic stats)
- [x] Image upload for players/teams/auctions
- [x] Auto-advance on sold/unsold
