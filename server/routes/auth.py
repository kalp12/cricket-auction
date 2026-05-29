from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from db.database import get_db
from models.models import User
from auth.auth import get_current_user, create_access_token, ADMIN_USERNAME, ADMIN_PASSWORD, pwd_context
from schemas.auth import TokenResponse, UserResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT access token."""
    # First try DB-backed user lookup
    user = db.query(User).filter(User.username == form_data.username).first()
    if user and pwd_context.verify(form_data.password, user.password_hash):
        access_token = create_access_token(data={"sub": user.username, "role": user.role})
        return TokenResponse(access_token=access_token, token_type="bearer", role=user.role)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info (protected route)."""
    return current_user
