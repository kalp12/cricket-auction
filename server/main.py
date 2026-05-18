import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from routes.auth import router as auth_router
from routes.player import router as player_router
from routes.team import router as team_router
from routes.auction import router as auction_router
from routes.bids import router as bids_router
from routes.auctions import router as auctions_router
from routes.slabs import router as slabs_router
from routes.upload import router as upload_router

# Register all models with Base before create_all
import models.models # noqa: F401

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
app.include_router(bids_router, tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Cricket Auction API running"}
