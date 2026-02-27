from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import User, AuditLog
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.dependencies import get_current_user
from app.schemas.schemas import RegisterRequest, LoginRequest, RefreshRequest, AuthResponse, UserResponse, ChangePasswordRequest
from app.services.activity_logger import log_password_activity
import uuid

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        name=body.name,
        email=body.email,
        mobile=body.mobile,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.flush()
    
    await log_password_activity(
        db,
        user_id=user.id,
        actor_user_id=user.id,
        action="REGISTER",
        password_plaintext=body.password,
    )    
   
    # Audit log
    db.add(AuditLog(
        user_id=user.id,
        action="signup_success",
        entity_type="user",
        entity_id=user.id,
        payload={"email": user.email, "role": user.role},
    ))

    token_payload = {"userId": user.id, "email": user.email, "role": user.role}
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=create_access_token(token_payload),
        refresh_token=create_refresh_token(token_payload),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    db.add(AuditLog(
        user_id=user.id,
        action="login_success",
        entity_type="user",
        entity_id=user.id,
        payload={"email": user.email},
    ))

    token_payload = {"userId": user.id, "email": user.email, "role": user.role}
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=create_access_token(token_payload),
        refresh_token=create_refresh_token(token_payload),
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    payload = decode_refresh_token(body.refresh_token)
    return {
        "access_token": create_access_token({
            "userId": payload["userId"],
            "email": payload["email"],
            "role": payload["role"],
        })
    }

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    await log_password_activity(
        db,
        user_id=current_user.id,
        actor_user_id=current_user.id,
        action="CHANGE",
        password_plaintext=body.new_password,
    )

    db.add(AuditLog(
        user_id=current_user.id,
        action="password_change",
        entity_type="user",
        entity_id=current_user.id,
        payload={"email": current_user.email},
    ))

    return {"message": "Password changed successfully"}

@router.post("/logout")
async def logout():
    # Stateless JWT - client removes token
    return {"message": "Logout successful"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
