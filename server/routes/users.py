import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.models import User
from auth.auth import get_current_user, pwd_context, require_role, create_access_token
from schemas.auth import UserResponse, UserCreate, InviteRequest, InviteResponse, RoleUpdate, TokenResponse

router = APIRouter()


@router.get("", response_model=List[UserResponse])
def list_users(current_user: UserResponse = Depends(require_role("owner", "editor")), db: Session = Depends(get_db)):
    """List all users (owner/editor only)."""
    return db.query(User).order_by(User.id).all()


@router.post("/invite", response_model=InviteResponse)
def invite_user(invite: InviteRequest, current_user: UserResponse = Depends(require_role("owner")), db: Session = Depends(get_db)):
    """Invite a new user by email (owner only). Generates an invite token."""
    if invite.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invite role must be 'editor' or 'viewer'")
    # Check if email already has a user
    existing = db.query(User).filter(User.email == invite.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    token = str(uuid.uuid4())
    # Store pending invite as a user record with invite_token
    pending = User(
        email=invite.email,
        username="",  # placeholder, filled on registration
        password_hash="",  # placeholder
        role=invite.role,
        invite_token=token,
    )
    db.add(pending)
    db.commit()
    db.refresh(pending)
    return InviteResponse(invite_token=token, email=invite.email, role=invite.role)


@router.post("/register", response_model=TokenResponse)
def register_with_invite(data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user using an invite token (public — no auth required)."""
    pending = db.query(User).filter(User.invite_token == data.invite_token).first()
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    # Check username uniqueness
    existing = db.query(User).filter(User.username == data.username).first()
    if existing and existing.id != pending.id:
        raise HTTPException(status_code=400, detail="Username already taken")
    pending.username = data.username
    pending.password_hash = pwd_context.hash(data.password)
    pending.invite_token = None  # consumed
    db.commit()
    db.refresh(pending)
    access_token = create_access_token(data={"sub": pending.username, "role": pending.role})
    return TokenResponse(access_token=access_token, token_type="bearer", role=pending.role)


@router.patch("/{user_id}/role", response_model=UserResponse)
def change_role(user_id: int, role_update: RoleUpdate, current_user: UserResponse = Depends(require_role("owner")), db: Session = Depends(get_db)):
    """Change a user's role (owner only). Cannot demote self."""
    if role_update.role not in ("owner", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be 'owner', 'editor', or 'viewer'")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.username == current_user.username and role_update.role != "owner":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    target.role = role_update.role
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{user_id}")
def delete_user(user_id: int, current_user: UserResponse = Depends(require_role("owner")), db: Session = Depends(get_db)):
    """Delete a user (owner only). Cannot delete self."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(target)
    db.commit()
    return {"message": "User deleted successfully"}
