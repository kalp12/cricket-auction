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
    username: Optional[str] = None
    role: str = "viewer"
    email: Optional[str] = None
    invite_token: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    invite_token: str


class InviteRequest(BaseModel):
    email: str
    role: str = "viewer"


class RoleUpdate(BaseModel):
    role: str


class InviteResponse(BaseModel):
    invite_token: str
    email: str
    role: str
