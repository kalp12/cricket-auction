import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base, SessionLocal
from sqlalchemy import text
from routes.auth import router as auth_router
from routes.player import router as player_router
from routes.team import router as team_router
from routes.auction import router as auction_router
from routes.bids import router as bids_router
from routes.auctions import router as auctions_router
from routes.slabs import router as slabs_router
from routes.upload import router as upload_router
from routes.stats import router as stats_router
from routes.import_players import router as import_router
from routes.registration import router as registration_router

# Register all models with Base before create_all
import models.models  # noqa: F401

app = FastAPI(title="Cricket Auction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
Base.metadata.create_all(bind=engine)


# Migrate: add missing columns to existing tables
def run_migrations():
    migrations = [
        ("auctions", "image_url", "ALTER TABLE auctions ADD COLUMN image_url VARCHAR"),
        ("players", "matches", "ALTER TABLE players ADD COLUMN matches INTEGER DEFAULT 0"),
        ("players", "runs", "ALTER TABLE players ADD COLUMN runs INTEGER DEFAULT 0"),
        ("players", "wickets", "ALTER TABLE players ADD COLUMN wickets INTEGER DEFAULT 0"),
        ("players", "batting_avg", "ALTER TABLE players ADD COLUMN batting_avg FLOAT DEFAULT 0"),
        ("players", "batting_sr", "ALTER TABLE players ADD COLUMN batting_sr FLOAT DEFAULT 0"),
        ("players", "bowling_avg", "ALTER TABLE players ADD COLUMN bowling_avg FLOAT DEFAULT 0"),
        ("players", "bowling_econ", "ALTER TABLE players ADD COLUMN bowling_econ FLOAT DEFAULT 0"),
        ("auctions", "sponsor_tl", "ALTER TABLE auctions ADD COLUMN sponsor_tl VARCHAR"),
        ("auctions", "sponsor_tr", "ALTER TABLE auctions ADD COLUMN sponsor_tr VARCHAR"),
        ("auctions", "sponsor_bl", "ALTER TABLE auctions ADD COLUMN sponsor_bl VARCHAR"),
        ("auctions", "sponsor_br", "ALTER TABLE auctions ADD COLUMN sponsor_br VARCHAR"),
        ("auctions", "timer_mode", "ALTER TABLE auctions ADD COLUMN timer_mode VARCHAR DEFAULT 'auto'"),
        ("auctions", "overlay_bg", "ALTER TABLE auctions ADD COLUMN overlay_bg VARCHAR"),
        ("auctions", "sold_stamp", "ALTER TABLE auctions ADD COLUMN sold_stamp VARCHAR"),
        ("auctions", "unsold_stamp", "ALTER TABLE auctions ADD COLUMN unsold_stamp VARCHAR"),
        ("auctions", "lower_third_banner", "ALTER TABLE auctions ADD COLUMN lower_third_banner VARCHAR"),
        ("auctions", "sound_gavel", "ALTER TABLE auctions ADD COLUMN sound_gavel VARCHAR"),
        ("auctions", "sound_unsold", "ALTER TABLE auctions ADD COLUMN sound_unsold VARCHAR"),
        ("auctions", "sound_timer", "ALTER TABLE auctions ADD COLUMN sound_timer VARCHAR"),
        ("auctions", "sound_celebration", "ALTER TABLE auctions ADD COLUMN sound_celebration VARCHAR"),        ("auctions", "registration_open", "ALTER TABLE auctions ADD COLUMN registration_open INTEGER DEFAULT 0"),
    ]

    db = SessionLocal()
    try:
        # Add missing columns
        for table, column, alter_sql in migrations:
            result = db.execute(text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_name = '{table}' AND column_name = '{column}'"
            ))
            if result.fetchone() is None:
                db.execute(text(alter_sql))
                db.commit()
                print(f"Migration: added {column} to {table}")

        # Migrate timer_enabled → timer_mode for existing rows
        result = db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'auctions' AND column_name = 'timer_enabled'"
        ))
        if result.fetchone() is not None:
            db.execute(text(
                "UPDATE auctions SET timer_mode = CASE "
                "WHEN timer_enabled = 1 THEN 'auto' "
                "ELSE 'off' END "
                "WHERE timer_mode IS NULL OR timer_mode = ''"
            ))
            db.execute(text("ALTER TABLE auctions DROP COLUMN timer_enabled"))
            db.commit()
            print("Migration: converted timer_enabled to timer_mode")
    except Exception as e:
        print(f"Migration error: {e}")
        db.rollback()
    finally:
        db.close()


run_migrations()

# Serve uploaded files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(player_router, prefix="/api/players", tags=["players"])
app.include_router(team_router, prefix="/api/teams", tags=["teams"])
app.include_router(auction_router, prefix="/api/auction", tags=["auction"])
app.include_router(auctions_router, prefix="/api/auctions", tags=["auctions"])
app.include_router(slabs_router, prefix="/api/slabs", tags=["slabs"])
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])
app.include_router(stats_router, prefix="/api", tags=["stats"])
app.include_router(import_router, prefix="/api/import", tags=["import"])
app.include_router(registration_router, prefix="/api/registration", tags=["registration"])
app.include_router(bids_router, tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Cricket Auction API running"}
