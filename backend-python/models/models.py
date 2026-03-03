"""
SQLAlchemy models mirroring the Prisma schema from the TypeScript backend.
Each model maps 1-to-1 with a Prisma model.
"""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Boolean, Integer, Float, DateTime, Text,
    ForeignKey, UniqueConstraint, Index, Enum as SAEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
import enum
from app.db.database import Base

# ─── Enums ──────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    MASTER_ADMIN = "MASTER_ADMIN"
    SOCIETY_ADMIN = "SOCIETY_ADMIN"
    TREASURER = "TREASURER"
    BILLING_OPERATOR = "BILLING_OPERATOR"
    APPROVER = "APPROVER"
    AUDITOR = "AUDITOR"
    COMMITTEE_USER = "COMMITTEE_USER"
    RESIDENT = "RESIDENT"


class AccessRole(str, enum.Enum):
    ADMIN = "ADMIN"
    COMMITTEE = "COMMITTEE"
    VIEWER = "VIEWER"


class MemberStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    VACANT = "VACANT"


class BasisType(str, enum.Enum):
    FLAT = "FLAT"
    PER_BHK = "PER_BHK"
    PER_SQFT = "PER_SQFT"
    PER_WATER_READING = "PER_WATER_READING"
    PER_DG_READING = "PER_DG_READING"
    PER_METER_READING = "PER_METER_READING"
    PER_CUSTOM_KEY = "PER_CUSTOM_KEY"
    FORMULA = "FORMULA"


class Frequency(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    ONE_TIME = "ONE_TIME"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    GENERATED = "GENERATED"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class PaymentMode(str, enum.Enum):
    CASH = "CASH"
    CHEQUE = "CHEQUE"
    BANK_TRANSFER = "BANK_TRANSFER"
    UPI = "UPI"
    CARD = "CARD"
    OTHER = "OTHER"


class ReceiptStatus(str, enum.Enum):
    PROVISIONAL = "PROVISIONAL"
    FINAL = "FINAL"
    CANCELLED = "CANCELLED"


class NotificationChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    DELIVERED = "DELIVERED"


class PaymentUploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ─── Models ─────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    mobile: Mapped[Optional[str]] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.RESIDENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    society_accesses = relationship("SocietyAccess", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Society(Base):
    __tablename__ = "societies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String)
    state: Mapped[Optional[str]] = mapped_column(String)
    units: Mapped[int] = mapped_column(Integer, default=0)
    google_sheet_id: Mapped[Optional[str]] = mapped_column(String)
    created_by_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    accesses = relationship("SocietyAccess", back_populates="society")
    members = relationship("Member", back_populates="society")
    billing_heads = relationship("BillingHead", back_populates="society")
    invoices = relationship("Invoice", back_populates="society")
    bank_account = relationship("BankAccount", back_populates="society", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="society")

    __table_args__ = (Index("ix_societies_code", "code"),)


class SocietyAccess(Base):
    __tablename__ = "society_accesses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    access_role: Mapped[AccessRole] = mapped_column(SAEnum(AccessRole))
    granted_by_user_id: Mapped[Optional[str]] = mapped_column(String)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    society = relationship("Society", back_populates="accesses")
    user = relationship("User", back_populates="society_accesses")

    __table_args__ = (UniqueConstraint("society_id", "user_id"),)


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    unit_no: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String)
    status: Mapped[MemberStatus] = mapped_column(SAEnum(MemberStatus), default=MemberStatus.ACTIVE)
    variables: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    society = relationship("Society", back_populates="members")
    invoices = relationship("Invoice", back_populates="member")

    __table_args__ = (UniqueConstraint("society_id", "unit_no"),)


class BillingHead(Base):
    __tablename__ = "billing_heads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    society = relationship("Society", back_populates="billing_heads")
    line_items = relationship("BillingLineItem", back_populates="billing_head")


class BillingLineItem(Base):
    __tablename__ = "billing_line_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    billing_head_id: Mapped[str] = mapped_column(String, ForeignKey("billing_heads.id", ondelete="CASCADE"))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    basis_type: Mapped[BasisType] = mapped_column(SAEnum(BasisType))
    rate: Mapped[float] = mapped_column(Float, default=0)
    custom_key: Mapped[Optional[str]] = mapped_column(String)
    formula_text: Mapped[Optional[str]] = mapped_column(Text)
    frequency: Mapped[Frequency] = mapped_column(SAEnum(Frequency), default=Frequency.MONTHLY)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    sac_hsn_code: Mapped[Optional[str]] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    billing_head = relationship("BillingHead", back_populates="line_items")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    member_id: Mapped[str] = mapped_column(String, ForeignKey("members.id", ondelete="CASCADE"))
    invoice_no: Mapped[Optional[str]] = mapped_column(String)
    invoice_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    period_month: Mapped[int] = mapped_column(Integer)
    period_year: Mapped[int] = mapped_column(Integer)
    subtotal: Mapped[float] = mapped_column(Float)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0)
    igst_amount: Mapped[float] = mapped_column(Float, default=0)
    tax_amount: Mapped[float] = mapped_column(Float)
    rounding_amount: Mapped[float] = mapped_column(Float, default=0)
    total_amount: Mapped[float] = mapped_column(Float)
    amount_paid: Mapped[float] = mapped_column(Float, default=0)
    balance_amount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[InvoiceStatus] = mapped_column(SAEnum(InvoiceStatus), default=InvoiceStatus.GENERATED)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    terms_and_conditions: Mapped[Optional[str]] = mapped_column(Text)
    payment_instructions: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    society = relationship("Society", back_populates="invoices")
    member = relationship("Member", back_populates="invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice")
    payments = relationship("Payment", back_populates="invoice")
    receipts = relationship("Receipt", back_populates="invoice")
    payment_uploads = relationship("PaymentUploadReference", back_populates="invoice")

    __table_args__ = (
        UniqueConstraint("society_id", "invoice_no"),
        UniqueConstraint("society_id", "member_id", "period_month", "period_year"),
    )


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id", ondelete="CASCADE"))
    line_item_name: Mapped[str] = mapped_column(String)
    basis_type: Mapped[BasisType] = mapped_column(SAEnum(BasisType))
    units: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    sac_hsn_code: Mapped[Optional[str]] = mapped_column(String)

    invoice = relationship("Invoice", back_populates="line_items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id", ondelete="CASCADE"))
    amount_paid: Mapped[float] = mapped_column(Float)
    paid_on: Mapped[datetime] = mapped_column(DateTime)
    mode: Mapped[PaymentMode] = mapped_column(SAEnum(PaymentMode))
    reference_no: Mapped[Optional[str]] = mapped_column(String)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="payments")


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id", ondelete="CASCADE"))
    receipt_no: Mapped[str] = mapped_column(String, nullable=False)
    amount_received: Mapped[float] = mapped_column(Float)
    status: Mapped[ReceiptStatus] = mapped_column(SAEnum(ReceiptStatus), default=ReceiptStatus.FINAL)
    issued_on: Mapped[datetime] = mapped_column(DateTime)
    cancelled_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    file_url: Mapped[Optional[str]] = mapped_column(String)
    created_by_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="receipts")

    __table_args__ = (UniqueConstraint("society_id", "receipt_no"),)


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"), unique=True)
    bank_name: Mapped[str] = mapped_column(String, nullable=False)
    account_holder_name: Mapped[str] = mapped_column(String, nullable=False)
    account_number: Mapped[str] = mapped_column(String, nullable=False)  # stored encrypted
    ifsc_code: Mapped[str] = mapped_column(String, nullable=False)
    upi_id: Mapped[Optional[str]] = mapped_column(String)
    qr_code_url: Mapped[Optional[str]] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    society = relationship("Society", back_populates="bank_account")


class PaymentUploadReference(Base):
    __tablename__ = "payment_upload_references"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id", ondelete="CASCADE"))
    submitted_by_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    amount: Mapped[float] = mapped_column(Float)
    transaction_ref: Mapped[str] = mapped_column(String)
    paid_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[PaymentUploadStatus] = mapped_column(SAEnum(PaymentUploadStatus), default=PaymentUploadStatus.PENDING)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    verified_by_user_id: Mapped[Optional[str]] = mapped_column(String)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="payment_uploads")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    invoice_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("invoices.id", ondelete="SET NULL"))
    member_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id", ondelete="SET NULL"))
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel))
    status: Mapped[NotificationStatus] = mapped_column(SAEnum(NotificationStatus), default=NotificationStatus.PENDING)
    provider_ref: Mapped[Optional[str]] = mapped_column(String)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    society_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("societies.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String)
    entity_id: Mapped[Optional[str]] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    before_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    after_snapshot: Mapped[Optional[dict]] = mapped_column(JSON)
    source_ip: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
    society = relationship("Society", back_populates="audit_logs")

class MaintenanceCalculationLog(Base):
    __tablename__ = "maintenance_calculation_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    member_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("members.id", ondelete="SET NULL"))
    calculation_type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InvoiceGenerationLog(Base):
    __tablename__ = "invoice_generation_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    generated_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BankReceiptActivityLog(Base):
    __tablename__ = "bank_receipt_activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    society_id: Mapped[str] = mapped_column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    invoice_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("invoices.id", ondelete="SET NULL"))
    receipt_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("receipts.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PasswordActivityLog(Base):
    __tablename__ = "password_activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    actor_user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    password_plaintext: Mapped[Optional[str]] = mapped_column(Text)


class FrontendActivityLog(Base):
    __tablename__ = "frontend_activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))
    society_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("societies.id", ondelete="SET NULL"))
    method: Mapped[str] = mapped_column(String, nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    query_params: Mapped[dict] = mapped_column(JSON, default=dict)
    request_body: Mapped[Optional[dict]] = mapped_column(JSON)
    source_ip: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
