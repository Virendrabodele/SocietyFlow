from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import (
    MaintenanceCalculationLog,
    InvoiceGenerationLog,
    BankReceiptActivityLog,
    PasswordActivityLog,
)


def _safe_plain_password(password: Optional[str]) -> Optional[str]:
    if not password:
        return None
    if settings.STORE_PLAIN_PASSWORD_IN_ACTIVITY_LOGS:
        return password
    return None


async def log_invoice_generation(
    db: AsyncSession,
    *,
    user_id: str,
    society_id: str,
    period_month: int,
    period_year: int,
    generated_count: int,
    skipped_count: int,
) -> None:
    db.add(
        InvoiceGenerationLog(
            user_id=user_id,
            society_id=society_id,
            period_month=period_month,
            period_year=period_year,
            generated_count=generated_count,
            skipped_count=skipped_count,
        )
    )


async def log_maintenance_calculation(
    db: AsyncSession,
    *,
    user_id: str,
    society_id: str,
    member_id: Optional[str],
    calculation_type: str,
    amount: float,
    meta: Optional[dict] = None,
) -> None:
    db.add(
        MaintenanceCalculationLog(
            user_id=user_id,
            society_id=society_id,
            member_id=member_id,
            calculation_type=calculation_type,
            amount=amount,
            meta=meta or {},
        )
    )


async def log_bank_receipt_activity(
    db: AsyncSession,
    *,
    user_id: str,
    society_id: str,
    invoice_id: Optional[str],
    receipt_id: Optional[str],
    action: str,
    details: Optional[dict] = None,
) -> None:
    db.add(
        BankReceiptActivityLog(
            user_id=user_id,
            society_id=society_id,
            invoice_id=invoice_id,
            receipt_id=receipt_id,
            action=action,
            details=details or {},
        )
    )


async def log_password_activity(
    db: AsyncSession,
    *,
    user_id: str,
    action: str,
    actor_user_id: Optional[str],
    password_plaintext: Optional[str],
) -> None:
    db.add(
        PasswordActivityLog(
            user_id=user_id,
            actor_user_id=actor_user_id,
            action=action,
            changed_at=datetime.utcnow(),
            password_plaintext=_safe_plain_password(password_plaintext),
        )
    )
