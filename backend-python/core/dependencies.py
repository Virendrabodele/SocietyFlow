from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.models import User, SocietyAccess, UserRole

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("userId")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_roles(*roles: UserRole):
    """Role-based access control decorator."""
    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return _checker


async def verify_society_access(
    society_id: str,
    current_user: User,
    db: AsyncSession,
    required_role: str = None,
) -> SocietyAccess:
    """Check if user has access to a specific society."""
    if current_user.role == UserRole.MASTER_ADMIN:
        return True  # Master admin has access to all societies

    result = await db.execute(
        select(SocietyAccess).where(
            SocietyAccess.society_id == society_id,
            SocietyAccess.user_id == current_user.id,
        )
    )
    access = result.scalar_one_or_none()

    if not access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this society")

    return access
