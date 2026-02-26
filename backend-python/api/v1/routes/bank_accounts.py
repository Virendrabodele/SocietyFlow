from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.db.database import get_db
from app.models.models import (
    User, BankAccount, Invoice, Payment, PaymentUploadReference,
    PaymentUploadStatus, InvoiceStatus, PaymentMode
)
from app.core.dependencies import get_current_user, verify_society_access
from app.schemas.schemas import (
    CreateBankAccountRequest, BankAccountResponse,
    UploadPaymentReferenceRequest, VerifyPaymentRequest
)
import uuid
import re

router = APIRouter()


def mask_account_number(number: str) -> str:
    if len(number) <= 4:
        return number
    return "X" * (len(number) - 4) + number[-4:]


# ─── Bank Account ────────────────────────────────────────────

@router.post("/{society_id}/bank-account", status_code=201)
async def create_bank_account(
    society_id: str,
    body: CreateBankAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(select(BankAccount).where(BankAccount.society_id == society_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bank account already exists. Use PUT to update.")

    account = BankAccount(
        id=str(uuid.uuid4()),
        society_id=society_id,
        bank_name=body.bank_name,
        account_holder_name=body.account_holder_name,
        account_number=body.account_number,  # In production, encrypt this
        ifsc_code=body.ifsc_code,
        upi_id=body.upi_id,
        qr_code_url=body.qr_code_url,
    )
    db.add(account)
    await db.flush()
    return {"id": account.id, "message": "Bank account created"}


@router.get("/{society_id}/bank-account")
async def get_bank_account(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(select(BankAccount).where(BankAccount.society_id == society_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No bank account configured")

    return {
        "id": account.id,
        "bank_name": account.bank_name,
        "account_holder_name": account.account_holder_name,
        "account_number": mask_account_number(account.account_number),
        "ifsc_code": account.ifsc_code,
        "upi_id": account.upi_id,
        "qr_code_url": account.qr_code_url,
    }


@router.put("/{society_id}/bank-account")
async def update_bank_account(
    society_id: str,
    body: CreateBankAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(select(BankAccount).where(BankAccount.society_id == society_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    for field, value in body.model_dump().items():
        setattr(account, field, value)

    return {"message": "Bank account updated"}


@router.delete("/{society_id}/bank-account", status_code=204)
async def delete_bank_account(
    society_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)
    result = await db.execute(select(BankAccount).where(BankAccount.society_id == society_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    await db.delete(account)


# ─── Payment Upload (Resident flow) ─────────────────────────

@router.post("/{society_id}/invoices/{invoice_id}/payment-upload", status_code=201)
async def upload_payment_reference(
    society_id: str,
    invoice_id: str,
    body: UploadPaymentReferenceRequest,
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

    upload = PaymentUploadReference(
        id=str(uuid.uuid4()),
        invoice_id=invoice_id,
        submitted_by_user_id=current_user.id,
        amount=body.amount,
        transaction_ref=body.transaction_ref,
        paid_date=body.paid_date,
        status=PaymentUploadStatus.PENDING,
    )
    db.add(upload)
    await db.flush()
    return {"id": upload.id, "message": "Payment reference submitted for verification"}


@router.get("/{society_id}/payment-uploads")
async def list_payment_uploads(
    society_id: str,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    query = (
        select(PaymentUploadReference)
        .join(Invoice, PaymentUploadReference.invoice_id == Invoice.id)
        .where(Invoice.society_id == society_id)
    )
    if status:
        query = query.where(PaymentUploadReference.status == status)

    result = await db.execute(query.order_by(PaymentUploadReference.created_at.desc()))
    uploads = result.scalars().all()

    return [
        {
            "id": u.id,
            "invoice_id": u.invoice_id,
            "amount": u.amount,
            "transaction_ref": u.transaction_ref,
            "paid_date": u.paid_date,
            "status": u.status,
            "submitted_by": u.submitted_by_user_id,
            "created_at": u.created_at,
        }
        for u in uploads
    ]


@router.post("/{society_id}/payment-uploads/{upload_id}/verify")
async def verify_payment_upload(
    society_id: str,
    upload_id: str,
    body: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_society_access(society_id, current_user, db)

    result = await db.execute(
        select(PaymentUploadReference).where(PaymentUploadReference.id == upload_id)
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Payment upload not found")

    if upload.status != PaymentUploadStatus.PENDING:
        raise HTTPException(status_code=400, detail="Upload already processed")

    if body.action == "APPROVE":
        upload.status = PaymentUploadStatus.APPROVED
        upload.verified_by_user_id = current_user.id
        upload.verified_at = datetime.utcnow()

        # Auto-create payment and update invoice
        result = await db.execute(select(Invoice).where(Invoice.id == upload.invoice_id))
        invoice = result.scalar_one_or_none()
        if invoice:
            payment = Payment(
                id=str(uuid.uuid4()),
                society_id=society_id,
                invoice_id=invoice.id,
                amount_paid=upload.amount,
                paid_on=upload.paid_date,
                mode=PaymentMode.UPI,
                reference_no=upload.transaction_ref,
            )
            db.add(payment)
            invoice.amount_paid += upload.amount
            invoice.balance_amount -= upload.amount
            invoice.status = (
                InvoiceStatus.PAID if invoice.balance_amount <= 0 else InvoiceStatus.PARTIALLY_PAID
            )

    else:  # REJECT
        upload.status = PaymentUploadStatus.REJECTED
        upload.rejection_reason = body.rejection_reason

    return {"message": f"Payment upload {body.action.lower()}d successfully"}
