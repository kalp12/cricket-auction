#!/usr/bin/env python

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from models.models import Player, Team, TeamPlayer, Auction, Bid
from routes.auth import router as auth_router
from routes.player import router as player_router
from routes.team import router as team_router
from routes.auction import router as auction_router

app = FastAPI(title="Cricket Auction API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
Base.metadata.create_all(bind=engine)

# Include auth router
app.include_router(auth_router, prefix="/api/auth")

# Include player router
app.include_router(player_router, prefix="/api/players", tags=["players"])

# Include team router
app.include_router(team_router, prefix="/api/teams", tags=["teams"])

app.include_router(auction_router, prefix="/api/auction", tags=["auction"])


# Placeholder root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the Cricket Auction API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
