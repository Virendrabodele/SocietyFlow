# Payment Operations API Documentation

## Overview

This document describes the bank transfer payment system with payment proof submission and verification workflow.

## Features

- Society bank account management
- Payment submission with proof upload
- Payment verification workflow
- Encrypted storage of sensitive bank details
- Masked display of account information

## API Endpoints

### Bank Account Management

#### 1. Create Bank Account

**Endpoint:** `POST /api/v1/societies/:id/bank-accounts`

**Authorization:** MASTER_ADMIN, SOCIETY_ADMIN, TREASURER

**Request Body:**
```json
{
  "bankName": "State Bank of India",
  "accountHolderName": "ABC Society Trust",
  "accountNumber": "1234567890123456",
  "ifscCode": "SBIN0001234",
  "upiId": "abc.society@sbi",
  "qrCodeUrl": "https://example.com/qr-codes/abc-society.png",
  "isDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account created successfully",
  "data": {
    "id": "uuid",
    "societyId": "uuid",
    "bankName": "State Bank of India",
    "accountHolderName": "ABC Society Trust",
    "accountNumber": "XXXXXXXXXXXX3456",
    "accountNumberLast4": "3456",
    "ifscCode": "SBIN0001234",
    "upiId": "abc.society@sbi",
    "qrCodeUrl": "https://example.com/qr-codes/abc-society.png",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 2. Get All Bank Accounts

**Endpoint:** `GET /api/v1/societies/:id/bank-accounts?includeInactive=false`

**Authorization:** All authenticated users with society access

**Response:**
```json
{
  "success": true,
  "message": "Bank accounts retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "societyId": "uuid",
      "bankName": "State Bank of India",
      "accountHolderName": "ABC Society Trust",
      "accountNumber": "XXXXXXXXXXXX3456",
      "accountNumberLast4": "3456",
      "ifscCode": "SBINXXXX34",
      "upiId": "abc.society@sbi",
      "qrCodeUrl": "https://example.com/qr-codes/abc-society.png",
      "isDefault": true,
      "isActive": true
    }
  ]
}
```

#### 3. Get Full Bank Account Details

**Endpoint:** `GET /api/v1/societies/:id/bank-accounts/:accountId`

**Authorization:** All authenticated users with society access

**Use Case:** Display payment instructions to residents

**Response:**
```json
{
  "success": true,
  "message": "Bank account details retrieved successfully",
  "data": {
    "id": "uuid",
    "bankName": "State Bank of India",
    "accountHolderName": "ABC Society Trust",
    "accountNumber": "1234567890123456",
    "accountNumberMasked": "XXXXXXXXXXXX3456",
    "ifscCode": "SBIN0001234",
    "upiId": "abc.society@sbi",
    "qrCodeUrl": "https://example.com/qr-codes/abc-society.png"
  }
}
```

#### 4. Update Bank Account

**Endpoint:** `PATCH /api/v1/societies/:id/bank-accounts/:accountId`

**Authorization:** MASTER_ADMIN, SOCIETY_ADMIN, TREASURER

**Request Body:**
```json
{
  "upiId": "new.upi@sbi",
  "isDefault": false,
  "isActive": false
}
```

### Payment Submission

#### 5. Submit Payment Proof

**Endpoint:** `POST /api/v1/societies/:id/invoices/:invoiceId/payment-submit`

**Authorization:** All authenticated users with society access (including RESIDENT)

**Request Body:**
```json
{
  "amount": 5000.00,
  "transactionRef": "UTR123456789",
  "paidDate": "2024-01-15T10:30:00.000Z",
  "bankAccountId": "uuid",
  "proofFiles": [
    {
      "fileName": "payment-proof.jpg",
      "fileUrl": "https://s3.example.com/proofs/abc123.jpg",
      "fileSize": 245678,
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment submitted successfully",
  "data": {
    "id": "uuid",
    "societyId": "uuid",
    "invoiceId": "uuid",
    "amount": 5000.00,
    "transactionRef": "UTR123456789",
    "paidDate": "2024-01-15T10:30:00.000Z",
    "status": "SUBMITTED",
    "submittedByUserId": "uuid",
    "paymentProofs": [
      {
        "id": "uuid",
        "fileName": "payment-proof.jpg",
        "fileUrl": "https://s3.example.com/proofs/abc123.jpg",
        "fileSize": 245678,
        "mimeType": "image/jpeg",
        "uploadedAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "invoice": {
      "id": "uuid",
      "member": {
        "name": "John Doe",
        "unitNo": "A-101"
      },
      "totalAmount": 5000.00
    },
    "createdAt": "2024-01-15T10:35:00.000Z"
  }
}
```

#### 6. Verify or Reject Payment Submission

**Endpoint:** `POST /api/v1/societies/:id/payment-submissions/:submissionId/verify`

**Authorization:** MASTER_ADMIN, SOCIETY_ADMIN, TREASURER, COMMITTEE_USER

**Request Body (Verify):**
```json
{
  "action": "verify",
  "verificationNotes": "Payment verified against bank statement",
  "createReceipt": true
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "rejectionReason": "Incorrect transaction reference"
}
```

**Response (Verify):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "id": "uuid",
    "status": "VERIFIED",
    "verifiedByUserId": "uuid",
    "verifiedAt": "2024-01-15T14:00:00.000Z",
    "verificationNotes": "Payment verified against bank statement"
  }
}
```

**Side Effects (Verify):**
- Creates Payment record in database
- Updates Invoice status (GENERATED → PAID or PARTIALLY_PAID)
- Generates Receipt if `createReceipt` is true
- Logs audit event

#### 7. Get Payment Submissions

**Endpoint:** `GET /api/v1/societies/:id/payment-submissions`

**Authorization:** All authenticated users with society access

**Query Parameters:**
- `status` - Filter by status (PENDING, SUBMITTED, VERIFIED, REJECTED)
- `invoiceId` - Filter by specific invoice
- `fromDate` - Filter payments from date
- `toDate` - Filter payments to date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "message": "Payment submissions retrieved successfully",
  "data": {
    "submissions": [
      {
        "id": "uuid",
        "amount": 5000.00,
        "transactionRef": "UTR123456789",
        "paidDate": "2024-01-15T00:00:00.000Z",
        "status": "VERIFIED",
        "invoice": {
          "id": "uuid",
          "member": {
            "name": "John Doe",
            "unitNo": "A-101"
          }
        },
        "bankAccount": {
          "bankName": "State Bank of India",
          "accountNumberLast4": "3456"
        },
        "paymentProofs": [
          {
            "id": "uuid",
            "fileName": "proof.jpg",
            "fileUrl": "https://..."
          }
        ],
        "verifiedAt": "2024-01-15T14:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 145,
      "totalPages": 3
    }
  }
}
```

#### 8. Get Payment Submission by ID

**Endpoint:** `GET /api/v1/societies/:id/payment-submissions/:submissionId`

**Authorization:** All authenticated users with society access

**Response:**
```json
{
  "success": true,
  "message": "Payment submission retrieved successfully",
  "data": {
    "id": "uuid",
    "amount": 5000.00,
    "transactionRef": "UTR123456789",
    "paidDate": "2024-01-15T00:00:00.000Z",
    "status": "VERIFIED",
    "submittedByUserId": "uuid",
    "verifiedByUserId": "uuid",
    "verifiedAt": "2024-01-15T14:00:00.000Z",
    "verificationNotes": "Verified",
    "invoice": {
      "id": "uuid",
      "member": {
        "name": "John Doe",
        "unitNo": "A-101"
      },
      "lineItems": [...]
    },
    "bankAccount": {
      "bankName": "State Bank of India",
      "accountHolderName": "ABC Society Trust",
      "accountNumberLast4": "3456"
    },
    "paymentProofs": [
      {
        "id": "uuid",
        "fileName": "proof.jpg",
        "fileUrl": "https://...",
        "fileSize": 245678,
        "mimeType": "image/jpeg",
        "uploadedAt": "2024-01-15T10:35:00.000Z"
      }
    ]
  }
}
```

## Payment Status Lifecycle

```
PENDING → SUBMITTED → VERIFIED
                   ↘ REJECTED
```

- **PENDING**: Initial state (not currently used in API)
- **SUBMITTED**: Resident/admin has submitted payment proof
- **VERIFIED**: Committee/treasurer has verified the payment
- **REJECTED**: Payment proof rejected (needs resubmission)

## Invoice Status Updates

When a payment submission is verified:
- If `totalPaid >= totalAmount`: Invoice status → PAID
- If `totalPaid < totalAmount && totalPaid > 0`: Invoice status → PARTIALLY_PAID

## Security Features

### Account Number Encryption
- Account numbers are encrypted using AES-256-CBC before storage
- Decryption only happens when full details are needed
- Environment variable `ENCRYPTION_KEY` must be set (32 bytes)

### Account Number Masking
- Display format: `XXXXXXXXXXXX3456` (only last 4 digits shown)
- IFSC masking: `SBINXXXX34` (first 4 + last 2 visible)

### Access Control
- Residents can submit payment proofs
- Only committee/treasurer can verify/reject submissions
- All operations require society access verification

## Integration with Existing Features

### Audit Logging
All payment operations are logged:
- `bank_account_create`
- `bank_account_update`
- `payment_submission_create`
- `payment_submission_verify`
- `payment_submission_reject`

### Invoice Integration
- Payment submissions link to existing invoices
- Verification creates Payment records
- Invoice status automatically updated
- Receipt generation supported

## Environment Variables

```bash
# Required for encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# S3 for payment proof storage (optional)
S3_ENABLED=true
S3_BUCKET_NAME=societyflow-payment-proofs
```

## Error Handling

### Common Errors

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Payment amount exceeds remaining balance of 3000.00"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Invoice not found"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

## Frontend Integration Guide

### For Residents

1. **View Payment Instructions**
   - GET `/societies/:id/bank-accounts` to list accounts
   - GET `/societies/:id/bank-accounts/:accountId` for full details
   - Display account number, IFSC, UPI ID, QR code

2. **Submit Payment**
   - Upload proof files to S3/storage
   - POST `/societies/:id/invoices/:invoiceId/payment-submit` with file URLs
   - Show confirmation and track status

3. **Track Payment Status**
   - GET `/societies/:id/payment-submissions?invoiceId=xxx`
   - Display status: Submitted / Verified / Rejected

### For Committee/Treasurer

1. **View Pending Submissions**
   - GET `/societies/:id/payment-submissions?status=SUBMITTED`
   - Display list with member, amount, proof images

2. **Verify Payment**
   - View payment details and proof
   - POST `/societies/:id/payment-submissions/:id/verify` with action "verify"
   - Receipt is auto-generated

3. **Reject Payment**
   - POST with action "reject" and reason
   - Resident can resubmit

## Best Practices

1. **Always validate** payment amount doesn't exceed invoice total
2. **Store proof files** externally (S3) before creating submission
3. **Handle partial payments** by tracking remaining balance
4. **Generate receipts** immediately after verification
5. **Log all actions** for audit trail
6. **Mask sensitive data** in UI and logs
7. **Use HTTPS** for all API communication
8. **Validate file uploads** (size, type, malware scan)

## Database Models

### SocietyBankAccount
- Stores encrypted account numbers
- Supports multiple accounts per society
- One default account

### PaymentSubmission
- Links to Invoice
- Tracks verification status
- References bank account used

### PaymentProof
- Metadata for uploaded proof files
- Links to PaymentSubmission
- Stores file URL, size, mime type

## Next Steps

See related documentation:
- [Reminder Automation](./REMINDERS.md)
- [Resident Portal](./RESIDENT_PORTAL.md)
- [RBAC & Approvals](./RBAC_APPROVALS.md)
- [CA Reports](./CA_REPORTS.md)
