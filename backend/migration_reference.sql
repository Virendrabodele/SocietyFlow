-- Migration: Add Bank Account and Payment Upload Reference Support
-- This migration adds support for bank account-based payment collection flow

-- Add BankAccount table
CREATE TABLE IF NOT EXISTS "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "societyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "upiId" TEXT,
    "qrCodeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_societyId_fkey" FOREIGN KEY ("societyId")
        REFERENCES "Society" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add VerificationStatus enum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Add PaymentUploadReference table
CREATE TABLE IF NOT EXISTS "PaymentUploadReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "referenceNo" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "fileUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentUploadReference_invoiceId_fkey" FOREIGN KEY ("invoiceId")
        REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentUploadReference_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId")
        REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentUploadReference_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId")
        REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create unique constraint on BankAccount
CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_societyId_key" ON "BankAccount"("societyId");

-- Create indexes on BankAccount
CREATE INDEX IF NOT EXISTS "BankAccount_societyId_idx" ON "BankAccount"("societyId");
CREATE INDEX IF NOT EXISTS "BankAccount_isActive_idx" ON "BankAccount"("isActive");

-- Create indexes on PaymentUploadReference
CREATE INDEX IF NOT EXISTS "PaymentUploadReference_invoiceId_idx" ON "PaymentUploadReference"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentUploadReference_uploadedByUserId_idx" ON "PaymentUploadReference"("uploadedByUserId");
CREATE INDEX IF NOT EXISTS "PaymentUploadReference_verificationStatus_idx" ON "PaymentUploadReference"("verificationStatus");

-- Note: Run this migration using Prisma CLI:
-- npm run prisma:migrate dev --name add_bank_account_payment_flow
