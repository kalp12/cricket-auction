#!/usr/bin/env python

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import engine, Base
from models.models import Player, Team, TeamPlayer, Auction, Bid
from routes.auth import router as auth_router

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

# Placeholder root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the Cricket Auction API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
