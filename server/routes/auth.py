from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from server.auth.auth import (
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    get_current_user,
)
from server.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate admin user and return JWT access token.
    Accepts OAuth2PasswordRequestForm with username and password fields.
    """
    # Check against admin credentials from .env
    if form_data.username != ADMIN_USERNAME or not form_data.password == ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    from server.auth.auth import create_access_token
    access_token = create_access_token(data={"sub": form_data.username})

    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """
    Get current user info (protected route).
    """
    return current_user