from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.models.models import (
    User, Member, BillingLineItem, Invoice, Payment,
    Receipt, PaymentUploadReference, PaymentUploadStatus,
    InvoiceStatus, ReceiptStatus
)
from app.core.dependencies import get_current_user, verify_society_access
from app.schemas.schemas import (
    GenerateInvoicesRequest, CreatePaymentRequest,
    CreateReceiptRequest, InvoiceResponse
)
from app.services.invoice_service import generate_invoice_for_member
import uuid

router = APIRouter()


# ─── Generate Invoices ───────────────────────────────────────

@router.post("/{society_id}/invoices/generate")
async def generate_invoices(
    society_id: str,
    body: GenerateInvoicesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    # Get members
    query = select(Member).where(Member.society_id == society_id, Member.status == "ACTIVE")
    if body.member_ids:
        query = query.where(Member.id.in_(body.member_ids))

    result = await db.execute(query)
    members = result.scalars().all()

    # Get active billing line items
    result = await db.execute(
        select(BillingLineItem).where(
            BillingLineItem.society_id == society_id,
            BillingLineItem.is_active == True,
        )
    )
    line_items = result.scalars().all()

    # Get current invoice sequence
    result = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.society_id == society_id)
    )
    base_seq = result.scalar() or 0

    generated = []
    skipped = []

    for i, member in enumerate(members):
        invoice = await generate_invoice_for_member(
            db, society_id, member,
            body.period_month, body.period_year,
            line_items, base_seq + i + 1,
        )
        if invoice:
            generated.append(invoice.id)
        else:
            skipped.append(member.unit_no)

    return {
        "generated": len(generated),
        "skipped": len(skipped),
        "skipped_units": skipped,
        "invoice_ids": generated,
    }


# ─── Get Invoices ────────────────────────────────────────────

@router.get("/{society_id}/invoices")
async def list_invoices(
    society_id: str,
    period_month: Optional[int] = None,
    period_year: Optional[int] = None,
    status: Optional[str] = None,
    member_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    query = select(Invoice).where(Invoice.society_id == society_id)
    if period_month:
        query = query.where(Invoice.period_month == period_month)
    if period_year:
        query = query.where(Invoice.period_year == period_year)
    if status:
        query = query.where(Invoice.status == status)
    if member_id:
        query = query.where(Invoice.member_id == member_id)

    result = await db.execute(query.order_by(Invoice.invoice_date.desc()))
    invoices = result.scalars().all()
    return [InvoiceResponse.model_validate(inv) for inv in invoices]


@router.get("/{society_id}/invoices/{invoice_id}")
async def get_invoice(
    society_id: str,
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.society_id == society_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


# ─── Payments ────────────────────────────────────────────────

@router.post("/{society_id}/invoices/{invoice_id}/payments", status_code=201)
async def create_payment(
    society_id: str,
    invoice_id: str,
    body: CreatePaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.society_id == society_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot add payment to cancelled invoice")

    if body.amount_paid > invoice.balance_amount:
        raise HTTPException(status_code=400, detail="Payment exceeds balance amount")

    payment = Payment(
        id=str(uuid.uuid4()),
        society_id=society_id,
        invoice_id=invoice_id,
        **body.model_dump(),
    )
    db.add(payment)

    # Update invoice
    invoice.amount_paid += body.amount_paid
    invoice.balance_amount -= body.amount_paid
    invoice.status = (
        InvoiceStatus.PAID if invoice.balance_amount <= 0 else InvoiceStatus.PARTIALLY_PAID
    )

    await db.flush()
    return {"id": payment.id, "message": "Payment recorded successfully"}


# ─── Receipts ────────────────────────────────────────────────

@router.post("/{society_id}/invoices/{invoice_id}/receipt", status_code=201)
async def create_receipt(
    society_id: str,
    invoice_id: str,
    body: CreateReceiptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(Payment).where(
            Payment.id == body.payment_id,
            Payment.invoice_id == invoice_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Generate receipt number
    result = await db.execute(
        select(func.count(Receipt.id)).where(Receipt.society_id == society_id)
    )
    seq = (result.scalar() or 0) + 1
    receipt_no = f"REC/{datetime.utcnow().year}/{seq:04d}"

    receipt = Receipt(
        id=str(uuid.uuid4()),
        society_id=society_id,
        invoice_id=invoice_id,
        receipt_no=receipt_no,
        amount_received=payment.amount_paid,
        issued_on=body.issued_on,
        created_by_user_id=current_user.id,
    )
    db.add(receipt)
    await db.flush()

    return {"id": receipt.id, "receipt_no": receipt_no, "message": "Receipt created"}
