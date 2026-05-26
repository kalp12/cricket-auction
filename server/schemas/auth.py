from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "owner"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str = "viewer"
    email: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    invite_token: str


class InviteRequest(BaseModel):
    email: str
    role: str = "viewer"  # editor / viewer


class RoleUpdate(BaseModel):
    role: str  # owner / editor / viewer


class InviteResponse(BaseModel):
    invite_token: str
    email: str
    role: str
