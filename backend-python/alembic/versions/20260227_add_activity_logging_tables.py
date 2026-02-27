"""add activity logging tables

Revision ID: 20260227_add_activity_logging_tables
Revises:
Create Date: 2026-02-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260227_add_activity_logging_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "maintenance_calculation_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("society_id", sa.String(), nullable=False),
        sa.Column("member_id", sa.String(), nullable=True),
        sa.Column("calculation_type", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "invoice_generation_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("society_id", sa.String(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=False),
        sa.Column("period_year", sa.Integer(), nullable=False),
        sa.Column("generated_count", sa.Integer(), nullable=False),
        sa.Column("skipped_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "bank_receipt_activity_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("society_id", sa.String(), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=True),
        sa.Column("receipt_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["receipt_id"], ["receipts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "password_activity_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("actor_user_id", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("password_plaintext", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "frontend_activity_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("society_id", sa.String(), nullable=True),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("query_params", sa.JSON(), nullable=False),
        sa.Column("request_body", sa.JSON(), nullable=True),
        sa.Column("source_ip", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("frontend_activity_logs")
    op.drop_table("password_activity_logs")
    op.drop_table("bank_receipt_activity_logs")
    op.drop_table("invoice_generation_logs")
    op.drop_table("maintenance_calculation_logs")
