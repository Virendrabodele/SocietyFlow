"""
Invoice generation service.
Translates billing configuration + member variables into invoices.
Mirrors the invoice generation logic from the TypeScript backend.
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    Member, BillingLineItem, Invoice, InvoiceLineItem,
    BasisType, InvoiceStatus
)
import uuid


def calculate_line_item_amount(item: BillingLineItem, variables: dict) -> float:
    """
    Calculate amount for a single billing line item based on member variables.
    Maps to the TypeScript calculateLineItemAmount() function.
    """
    basis = item.basis_type

    if basis == BasisType.FLAT:
        return item.rate

    elif basis == BasisType.PER_BHK:
        bhk = variables.get("bhk", 0)
        return item.rate * float(bhk)

    elif basis == BasisType.PER_SQFT:
        sqft = variables.get("sqft", 0)
        return item.rate * float(sqft)

    elif basis == BasisType.PER_WATER_READING:
        reading = variables.get("water_reading", 0)
        return item.rate * float(reading)

    elif basis == BasisType.PER_DG_READING:
        reading = variables.get("dg_reading", 0)
        return item.rate * float(reading)

    elif basis == BasisType.PER_METER_READING:
        reading = variables.get("meter_reading", 0)
        return item.rate * float(reading)

    elif basis == BasisType.PER_CUSTOM_KEY:
        key = item.custom_key or ""
        value = variables.get(key, 0)
        return item.rate * float(value)

    elif basis == BasisType.FORMULA:
        # Simple formula evaluation - extend as needed
        try:
            formula = item.formula_text or "0"
            # Replace variable references in formula
            for k, v in variables.items():
                formula = formula.replace(f"{{{k}}}", str(v))
            return float(eval(formula))  # noqa: S307
        except Exception:
            return 0.0

    return 0.0


async def generate_invoice_for_member(
    db: AsyncSession,
    society_id: str,
    member: Member,
    period_month: int,
    period_year: int,
    line_items: List[BillingLineItem],
    invoice_sequence: int,
) -> Optional[Invoice]:
    """Generate a single invoice for one member."""

    # Skip if invoice already exists
    result = await db.execute(
        select(Invoice).where(
            Invoice.society_id == society_id,
            Invoice.member_id == member.id,
            Invoice.period_month == period_month,
            Invoice.period_year == period_year,
        )
    )
    if result.scalar_one_or_none():
        return None  # Already generated

    # Calculate line items
    computed_lines = []
    subtotal = 0.0
    taxable_amount = 0.0
    cgst = 0.0
    sgst = 0.0

    for item in line_items:
        amount = calculate_line_item_amount(item, member.variables)
        if amount == 0:
            continue

        tax_amount_for_line = 0.0
        if item.taxable and item.tax_rate > 0:
            tax_amount_for_line = amount * (item.tax_rate / 100)
            taxable_amount += amount
            cgst += tax_amount_for_line / 2
            sgst += tax_amount_for_line / 2

        subtotal += amount
        computed_lines.append({
            "line_item_name": item.name,
            "basis_type": item.basis_type,
            "units": member.variables.get(item.custom_key or "bhk", 1),
            "rate": item.rate,
            "amount": amount,
            "taxable": item.taxable,
            "tax_rate": item.tax_rate,
            "sac_hsn_code": item.sac_hsn_code,
        })

    total_tax = cgst + sgst
    total = subtotal + total_tax

    # Format invoice number: SF/2025-26/0001
    fy_start = period_year if period_month >= 4 else period_year - 1
    fy_label = f"{fy_start}-{str(fy_start + 1)[-2:]}"
    invoice_no = f"SF/{fy_label}/{invoice_sequence:04d}"

    invoice = Invoice(
        id=str(uuid.uuid4()),
        society_id=society_id,
        member_id=member.id,
        invoice_no=invoice_no,
        invoice_date=datetime.utcnow(),
        period_month=period_month,
        period_year=period_year,
        subtotal=round(subtotal, 2),
        taxable_amount=round(taxable_amount, 2),
        cgst_amount=round(cgst, 2),
        sgst_amount=round(sgst, 2),
        igst_amount=0.0,
        tax_amount=round(total_tax, 2),
        total_amount=round(total, 2),
        amount_paid=0.0,
        balance_amount=round(total, 2),
        status=InvoiceStatus.GENERATED,
    )
    db.add(invoice)
    await db.flush()

    for line in computed_lines:
        db.add(InvoiceLineItem(id=str(uuid.uuid4()), invoice_id=invoice.id, **line))

    return invoice
