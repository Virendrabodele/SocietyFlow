from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import User, Society, SocietyAccess, UserRole, AccessRole
from app.core.dependencies import get_current_user, verify_society_access
from app.schemas.schemas import CreateSocietyRequest, UpdateSocietyRequest, SocietyResponse, GrantAccessRequest
from typing import List
import uuid

router = APIRouter()


@router.post("", response_model=SocietyResponse, status_code=201)
async def create_society(
    body: CreateSocietyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.MASTER_ADMIN:
        raise HTTPException(status_code=403, detail="Only MASTER_ADMIN can create societies")

    # Check unique code
    result = await db.execute(select(Society).where(Society.code == body.code))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Society code already exists")

    society = Society(
        id=str(uuid.uuid4()),
        name=body.name,
        code=body.code,
        city=body.city,
        state=body.state,
        units=body.units,
        created_by_user_id=current_user.id,
    )
    db.add(society)
    await db.flush()

    # Grant admin access to creator
    db.add(SocietyAccess(
        id=str(uuid.uuid4()),
        society_id=society.id,
        user_id=current_user.id,
        access_role=AccessRole.ADMIN,
        granted_by_user_id=current_user.id,
    ))

    return SocietyResponse.model_validate(society)


@router.get("", response_model=List[SocietyResponse])
async def list_societies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.MASTER_ADMIN:
        result = await db.execute(select(Society))
        societies = result.scalars().all()
    else:
        result = await db.execute(
            select(Society)
            .join(SocietyAccess, Society.id == SocietyAccess.society_id)
            .where(SocietyAccess.user_id == current_user.id)
        )
        societies = result.scalars().all()

    return [SocietyResponse.model_validate(s) for s in societies]


@router.get("/{society_id}", response_model=SocietyResponse)
async def get_society(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(select(Society).where(Society.id == society_id))
    society = result.scalar_one_or_none()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    return SocietyResponse.model_validate(society)


@router.put("/{society_id}", response_model=SocietyResponse)
async def update_society(
    society_id: str,
    body: UpdateSocietyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(select(Society).where(Society.id == society_id))
    society = result.scalar_one_or_none()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(society, field, value)

    return SocietyResponse.model_validate(society)


@router.post("/{society_id}/access")
async def grant_access(
    society_id: str,
    body: GrantAccessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    # Find user by email
    result = await db.execute(select(User).where(User.email == body.email))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if access already exists
    result = await db.execute(
        select(SocietyAccess).where(
            SocietyAccess.society_id == society_id,
            SocietyAccess.user_id == target_user.id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.access_role = body.access_role
    else:
        db.add(SocietyAccess(
            id=str(uuid.uuid4()),
            society_id=society_id,
            user_id=target_user.id,
            access_role=body.access_role,
            granted_by_user_id=current_user.id,
        ))

    return {"message": f"Access granted to {body.email}"}
