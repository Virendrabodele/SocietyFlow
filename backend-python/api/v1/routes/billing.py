from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.db.database import get_db
from app.models.models import User, BillingHead, BillingLineItem
from app.core.dependencies import get_current_user, verify_society_access
from app.schemas.schemas import CreateBillingHeadRequest, CreateBillingLineItemRequest
import uuid

router = APIRouter()


# ─── Billing Heads ───────────────────────────────────────────

@router.post("/{society_id}/billing-heads", status_code=201)
async def create_billing_head(
    society_id: str,
    body: CreateBillingHeadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    head = BillingHead(id=str(uuid.uuid4()), society_id=society_id, **body.model_dump())
    db.add(head)
    await db.flush()
    return {"id": head.id, "name": head.name, "sort_order": head.sort_order}


@router.get("/{society_id}/billing-heads")
async def list_billing_heads(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(BillingHead)
        .where(BillingHead.society_id == society_id, BillingHead.is_active == True)
        .order_by(BillingHead.sort_order)
    )
    heads = result.scalars().all()
    return [{"id": h.id, "name": h.name, "sort_order": h.sort_order} for h in heads]


# ─── Billing Line Items ──────────────────────────────────────

@router.post("/{society_id}/billing-line-items", status_code=201)
async def create_billing_line_item(
    society_id: str,
    body: CreateBillingLineItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    # Verify billing head belongs to society
    result = await db.execute(
        select(BillingHead).where(
            BillingHead.id == body.billing_head_id,
            BillingHead.society_id == society_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Billing head not found")

    item = BillingLineItem(id=str(uuid.uuid4()), society_id=society_id, **body.model_dump())
    db.add(item)
    await db.flush()
    return {"id": item.id, "name": item.name, "basis_type": item.basis_type, "rate": item.rate}


@router.get("/{society_id}/billing-line-items")
async def list_billing_line_items(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(BillingLineItem)
        .where(BillingLineItem.society_id == society_id, BillingLineItem.is_active == True)
    )
    items = result.scalars().all()
    return [
        {
            "id": i.id,
            "billing_head_id": i.billing_head_id,
            "name": i.name,
            "basis_type": i.basis_type,
            "rate": i.rate,
            "frequency": i.frequency,
            "taxable": i.taxable,
            "tax_rate": i.tax_rate,
        }
        for i in items
    ]
