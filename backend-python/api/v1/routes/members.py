from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.db.database import get_db
from app.models.models import User, Member
from app.core.dependencies import get_current_user, verify_society_access
from app.schemas.schemas import CreateMemberRequest, UpdateMemberRequest, MemberResponse, BulkCreateMembersRequest
import uuid

router = APIRouter()


@router.post("/{society_id}/members", response_model=MemberResponse, status_code=201)
async def create_member(
    society_id: str,
    body: CreateMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    # Check duplicate unit
    result = await db.execute(
        select(Member).where(Member.society_id == society_id, Member.unit_no == body.unit_no)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Unit {body.unit_no} already exists")

    member = Member(id=str(uuid.uuid4()), society_id=society_id, **body.model_dump())
    db.add(member)
    await db.flush()
    return MemberResponse.model_validate(member)


@router.post("/{society_id}/members/bulk", status_code=201)
async def bulk_create_members(
    society_id: str,
    body: BulkCreateMembersRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    created = []
    errors = []

    for m in body.members:
        result = await db.execute(
            select(Member).where(Member.society_id == society_id, Member.unit_no == m.unit_no)
        )
        if result.scalar_one_or_none():
            errors.append({"unit_no": m.unit_no, "error": "Unit already exists"})
            continue

        member = Member(id=str(uuid.uuid4()), society_id=society_id, **m.model_dump())
        db.add(member)
        created.append(m.unit_no)

    await db.flush()
    return {"created": len(created), "errors": errors}


@router.get("/{society_id}/members", response_model=List[MemberResponse])
async def list_members(
    society_id: str,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    query = select(Member).where(Member.society_id == society_id)
    if status:
        query = query.where(Member.status == status)

    result = await db.execute(query)
    members = result.scalars().all()
    return [MemberResponse.model_validate(m) for m in members]


@router.get("/{society_id}/members/{member_id}", response_model=MemberResponse)
async def get_member(
    society_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.society_id == society_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return MemberResponse.model_validate(member)


@router.put("/{society_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    society_id: str,
    member_id: str,
    body: UpdateMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.society_id == society_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(member, field, value)

    return MemberResponse.model_validate(member)


@router.delete("/{society_id}/members/{member_id}", status_code=204)
async def delete_member(
    society_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.society_id == society_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
