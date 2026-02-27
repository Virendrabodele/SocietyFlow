"""
Pydantic v2 schemas - replaces Zod schemas from the TypeScript backend.
These handle request validation and response serialization.
"""
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import (
    UserRole, AccessRole, MemberStatus, BasisType,
    Frequency, InvoiceStatus, PaymentMode, ReceiptStatus,
    PaymentUploadStatus
)
import re


# ─── Base ────────────────────────────────────────────────────

class BaseResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    data: Any = None


# ─── Auth ────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: Optional[str] = None
    role: UserRole = UserRole.RESIDENT

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a number")
        return v

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    mobile: Optional[str]
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str


# ─── Society ─────────────────────────────────────────────────

class CreateSocietyRequest(BaseModel):
    name: str
    code: str
    city: Optional[str] = None
    state: Optional[str] = None
    units: int = 0


class UpdateSocietyRequest(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    units: Optional[int] = None


class SocietyResponse(BaseModel):
    id: str
    name: str
    code: str
    city: Optional[str]
    state: Optional[str]
    units: int
    created_at: datetime

    model_config = {"from_attributes": True}


class GrantAccessRequest(BaseModel):
    email: EmailStr
    access_role: AccessRole


# ─── Member ──────────────────────────────────────────────────

class CreateMemberRequest(BaseModel):
    name: str
    unit_no: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: MemberStatus = MemberStatus.ACTIVE
    variables: dict = {}


class UpdateMemberRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[MemberStatus] = None
    variables: Optional[dict] = None


class MemberResponse(BaseModel):
    id: str
    society_id: str
    name: str
    unit_no: str
    phone: Optional[str]
    email: Optional[str]
    status: MemberStatus
    variables: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkCreateMembersRequest(BaseModel):
    members: List[CreateMemberRequest]


# ─── Billing ─────────────────────────────────────────────────

class CreateBillingHeadRequest(BaseModel):
    name: str
    sort_order: int = 0


class CreateBillingLineItemRequest(BaseModel):
    billing_head_id: str
    name: str
    basis_type: BasisType
    rate: float = 0
    custom_key: Optional[str] = None
    formula_text: Optional[str] = None
    frequency: Frequency = Frequency.MONTHLY
    taxable: bool = False
    tax_rate: float = 0
    sac_hsn_code: Optional[str] = None


# ─── Invoice ─────────────────────────────────────────────────

class GenerateInvoicesRequest(BaseModel):
    period_month: int
    period_year: int
    member_ids: Optional[List[str]] = None  # None = generate for all members

    @field_validator("period_month")
    @classmethod
    def valid_month(cls, v):
        if v < 1 or v > 12:
            raise ValueError("Month must be between 1 and 12")
        return v


class CreatePaymentRequest(BaseModel):
    amount_paid: float
    paid_on: datetime
    mode: PaymentMode
    reference_no: Optional[str] = None
    notes: Optional[str] = None


class CreateReceiptRequest(BaseModel):
    payment_id: str
    issued_on: datetime


class InvoiceLineItemResponse(BaseModel):
    id: str
    line_item_name: str
    basis_type: BasisType
    units: float
    rate: float
    amount: float
    taxable: bool
    tax_rate: float

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: str
    society_id: str
    member_id: str
    invoice_no: Optional[str]
    invoice_date: datetime
    due_date: Optional[datetime]
    period_month: int
    period_year: int
    subtotal: float
    tax_amount: float
    total_amount: float
    amount_paid: float
    balance_amount: float
    status: InvoiceStatus
    line_items: List[InvoiceLineItemResponse] = []

    model_config = {"from_attributes": True}


# ─── Bank Account ────────────────────────────────────────────

class CreateBankAccountRequest(BaseModel):
    bank_name: str
    account_holder_name: str
    account_number: str
    ifsc_code: str
    upi_id: Optional[str] = None
    qr_code_url: Optional[str] = None

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v):
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("Invalid IFSC code format (e.g. SBIN0001234)")
        return v


class BankAccountResponse(BaseModel):
    id: str
    bank_name: str
    account_holder_name: str
    account_number: str  # masked
    ifsc_code: str
    upi_id: Optional[str]

    model_config = {"from_attributes": True}


class UploadPaymentReferenceRequest(BaseModel):
    amount: float
    transaction_ref: str
    paid_date: datetime


class VerifyPaymentRequest(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v):
        if v not in ("APPROVE", "REJECT"):
            raise ValueError("Action must be APPROVE or REJECT")
        return v
