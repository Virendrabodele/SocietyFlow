from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.models.models import User, Invoice, Member, Payment, InvoiceStatus
from app.core.dependencies import get_current_user, verify_society_access
from datetime import datetime

router = APIRouter()


@router.get("/{society_id}/reports/collection-summary")
async def collection_summary(
    society_id: str,
    period_month: int,
    period_year: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Collection vs Outstanding summary for a given period."""
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(
            func.count(Invoice.id).label("total_invoices"),
            func.sum(Invoice.total_amount).label("total_billed"),
            func.sum(Invoice.amount_paid).label("total_collected"),
            func.sum(Invoice.balance_amount).label("total_outstanding"),
        ).where(
            Invoice.society_id == society_id,
            Invoice.period_month == period_month,
            Invoice.period_year == period_year,
        )
    )
    row = result.one()

    return {
        "period": f"{period_month}/{period_year}",
        "total_invoices": row.total_invoices or 0,
        "total_billed": float(row.total_billed or 0),
        "total_collected": float(row.total_collected or 0),
        "total_outstanding": float(row.total_outstanding or 0),
        "collection_percentage": (
            round((float(row.total_collected or 0) / float(row.total_billed or 1)) * 100, 2)
        ),
    }


@router.get("/{society_id}/reports/aging")
async def aging_report(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aging report: buckets overdue invoices by days outstanding."""
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(Invoice).where(
            Invoice.society_id == society_id,
            Invoice.balance_amount > 0,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    invoices = result.scalars().all()

    buckets = {"0_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    today = datetime.utcnow()

    for inv in invoices:
        if not inv.due_date:
            continue
        days_overdue = (today - inv.due_date).days
        if days_overdue <= 30:
            buckets["0_30"] += inv.balance_amount
        elif days_overdue <= 60:
            buckets["31_60"] += inv.balance_amount
        elif days_overdue <= 90:
            buckets["61_90"] += inv.balance_amount
        else:
            buckets["over_90"] += inv.balance_amount

    return {k: round(v, 2) for k, v in buckets.items()}


@router.get("/{society_id}/reports/member-ledger/{member_id}")
async def member_ledger(
    society_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full invoice + payment history for a single member."""
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(Invoice).where(
            Invoice.society_id == society_id,
            Invoice.member_id == member_id,
        ).order_by(Invoice.period_year, Invoice.period_month)
    )
    invoices = result.scalars().all()

    return [
        {
            "invoice_no": inv.invoice_no,
            "period": f"{inv.period_month}/{inv.period_year}",
            "total": inv.total_amount,
            "paid": inv.amount_paid,
            "balance": inv.balance_amount,
            "status": inv.status,
        }
        for inv in invoices
    ]
