# API Testing Guide - Bank Account Payment Flow

This document provides curl commands and Postman examples for testing the bank account payment flow APIs.

## Prerequisites

```bash
# Set environment variables
export API_BASE_URL="http://localhost:3000/api/v1"
export AUTH_TOKEN="your-jwt-token-here"
export SOCIETY_ID="your-society-id"
export INVOICE_ID="your-invoice-id"
```

## 1. Bank Account Management

### Create Bank Account

```bash
curl -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "ABC Housing Society",
    "accountNumber": "1234567890123456",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India",
    "branchName": "Koramangala Branch",
    "upiId": "abcsociety@sbi",
    "qrCodeUrl": "https://example.com/qr-code.png"
  }'
```

Expected Response (201 Created):
```json
{
  "success": true,
  "message": "Bank account created successfully",
  "data": {
    "id": "uuid-here",
    "societyId": "society-uuid",
    "accountName": "ABC Housing Society",
    "accountNumber": "1234567890123456",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India",
    "branchName": "Koramangala Branch",
    "upiId": "abcsociety@sbi",
    "qrCodeUrl": "https://example.com/qr-code.png",
    "isActive": true,
    "createdAt": "2024-02-23T10:00:00.000Z",
    "updatedAt": "2024-02-23T10:00:00.000Z"
  }
}
```

### Get Bank Account

```bash
curl -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Bank account retrieved successfully",
  "data": {
    "id": "uuid-here",
    "societyId": "society-uuid",
    "accountName": "ABC Housing Society",
    "accountNumber": "****3456",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India",
    "branchName": "Koramangala Branch",
    "upiId": "abcsociety@sbi",
    "qrCodeUrl": "https://example.com/qr-code.png",
    "isActive": true
  }
}
```

### Update Bank Account

```bash
curl -X PUT "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "upiId": "newsociety@paytm",
    "qrCodeUrl": "https://example.com/new-qr-code.png"
  }'
```

### Delete Bank Account

```bash
curl -X DELETE "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Bank account deleted successfully",
  "data": null
}
```

## 2. Payment Upload Flow

### Upload Payment Reference

```bash
curl -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/invoices/${INVOICE_ID}/payment-upload" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "referenceNo": "UTR202402231234567890",
    "transactionDate": "2024-02-23T10:30:00Z",
    "amount": 5000.00,
    "remarks": "Paid via NEFT from HDFC Bank",
    "fileUrl": "https://storage.example.com/payment-proofs/proof-123.png"
  }'
```

Expected Response (201 Created):
```json
{
  "success": true,
  "message": "Payment reference uploaded successfully",
  "data": {
    "id": "upload-uuid",
    "invoiceId": "invoice-uuid",
    "uploadedByUserId": "user-uuid",
    "referenceNo": "UTR202402231234567890",
    "transactionDate": "2024-02-23T10:30:00.000Z",
    "amount": 5000.00,
    "remarks": "Paid via NEFT from HDFC Bank",
    "fileUrl": "https://storage.example.com/payment-proofs/proof-123.png",
    "verificationStatus": "PENDING",
    "verifiedByUserId": null,
    "verifiedAt": null,
    "verificationNotes": null,
    "createdAt": "2024-02-23T10:35:00.000Z",
    "updatedAt": "2024-02-23T10:35:00.000Z"
  }
}
```

### Get Payment Uploads

#### Get All Pending Uploads
```bash
curl -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads?verificationStatus=PENDING" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

#### Get Uploads for Specific Invoice
```bash
curl -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads?invoiceId=${INVOICE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Payment uploads retrieved successfully",
  "data": [
    {
      "id": "upload-uuid",
      "invoiceId": "invoice-uuid",
      "referenceNo": "UTR202402231234567890",
      "transactionDate": "2024-02-23T10:30:00.000Z",
      "amount": 5000.00,
      "verificationStatus": "PENDING",
      "invoice": {
        "id": "invoice-uuid",
        "member": {
          "id": "member-uuid",
          "name": "John Doe",
          "unitNo": "A-101"
        }
      },
      "uploadedBy": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "verifiedBy": null,
      "verifiedAt": null
    }
  ]
}
```

### Verify Payment Reference

#### Approve Payment
```bash
curl -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads/${UPLOAD_ID}/verify" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "APPROVED",
    "verificationNotes": "Payment verified from bank statement. UTR matches."
  }'
```

#### Reject Payment
```bash
curl -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads/${UPLOAD_ID}/verify" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "REJECTED",
    "verificationNotes": "UTR number not found in bank statement. Please re-upload with correct details."
  }'
```

Expected Response (200 OK - Approved):
```json
{
  "success": true,
  "message": "Payment reference verified successfully",
  "data": {
    "id": "upload-uuid",
    "invoiceId": "invoice-uuid",
    "verificationStatus": "APPROVED",
    "verifiedByUserId": "verifier-uuid",
    "verifiedAt": "2024-02-23T11:00:00.000Z",
    "verificationNotes": "Payment verified from bank statement. UTR matches."
  }
}
```

## 3. Enhanced Invoice API

### Get Invoice with Bank Account Details

```bash
curl -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/invoices/${INVOICE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
```

Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Invoice retrieved successfully",
  "data": {
    "id": "invoice-uuid",
    "societyId": "society-uuid",
    "memberId": "member-uuid",
    "periodMonth": 2,
    "periodYear": 2024,
    "subtotal": 4500.00,
    "taxAmount": 500.00,
    "totalAmount": 5000.00,
    "status": "GENERATED",
    "member": {
      "id": "member-uuid",
      "name": "John Doe",
      "unitNo": "A-101",
      "email": "john@example.com",
      "phone": "+919876543210"
    },
    "society": {
      "id": "society-uuid",
      "name": "ABC Housing Society",
      "bankAccount": {
        "id": "bank-uuid",
        "accountName": "ABC Housing Society",
        "accountNumber": "****3456",
        "ifscCode": "SBIN0001234",
        "bankName": "State Bank of India",
        "branchName": "Koramangala Branch",
        "upiId": "abcsociety@sbi",
        "qrCodeUrl": "https://example.com/qr-code.png"
      }
    },
    "lineItems": [...],
    "payments": [...],
    "receipts": [...],
    "paymentUploads": [
      {
        "id": "upload-uuid",
        "referenceNo": "UTR202402231234567890",
        "amount": 5000.00,
        "verificationStatus": "PENDING",
        "uploadedBy": {
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ]
  }
}
```

## 4. Error Cases

### Invalid IFSC Code
```bash
curl -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "ABC Society",
    "accountNumber": "1234567890",
    "ifscCode": "INVALID",
    "bankName": "State Bank"
  }'
```

Expected Response (400 Bad Request):
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "ifscCode",
      "message": "Invalid IFSC code format"
    }
  ]
}
```

### Duplicate Bank Account
```bash
# Trying to create bank account when one already exists
```

Expected Response (400 Bad Request):
```json
{
  "success": false,
  "message": "Bank account already exists for this society"
}
```

### Unauthorized Access
```bash
curl -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account"
# Without Authorization header
```

Expected Response (401 Unauthorized):
```json
{
  "success": false,
  "message": "Authentication required"
}
```

## 5. Testing Workflow

### Complete Payment Flow Test

```bash
#!/bin/bash

# 1. Create bank account
echo "1. Creating bank account..."
BANK_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/bank-account" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "Test Society",
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "bankName": "SBI",
    "upiId": "test@sbi"
  }')
echo $BANK_RESPONSE | jq

# 2. Get invoice with bank account
echo -e "\n2. Fetching invoice with bank account..."
INVOICE_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/invoices/${INVOICE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")
echo $INVOICE_RESPONSE | jq '.data.society.bankAccount'

# 3. Upload payment reference
echo -e "\n3. Uploading payment reference..."
UPLOAD_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/invoices/${INVOICE_ID}/payment-upload" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "referenceNo": "UTR123456789",
    "transactionDate": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "amount": 5000.00,
    "remarks": "Test payment"
  }')
UPLOAD_ID=$(echo $UPLOAD_RESPONSE | jq -r '.data.id')
echo $UPLOAD_RESPONSE | jq

# 4. Get pending uploads
echo -e "\n4. Fetching pending uploads..."
curl -s -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads?verificationStatus=PENDING" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq

# 5. Verify payment
echo -e "\n5. Verifying payment..."
curl -s -X POST "${API_BASE_URL}/societies/${SOCIETY_ID}/payment-uploads/${UPLOAD_ID}/verify" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "APPROVED",
    "verificationNotes": "Verified successfully"
  }' | jq

# 6. Check invoice status
echo -e "\n6. Checking updated invoice status..."
curl -s -X GET "${API_BASE_URL}/societies/${SOCIETY_ID}/invoices/${INVOICE_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq '.data.status'

echo -e "\nTest completed!"
```

## 6. Postman Collection

Import this JSON into Postman:

```json
{
  "info": {
    "name": "SocietyFlow - Bank Account Payment Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api/v1"
    },
    {
      "key": "token",
      "value": "your-jwt-token"
    },
    {
      "key": "societyId",
      "value": "society-uuid"
    },
    {
      "key": "invoiceId",
      "value": "invoice-uuid"
    }
  ],
  "item": [
    {
      "name": "Bank Account",
      "item": [
        {
          "name": "Create Bank Account",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"accountName\": \"ABC Society\",\n  \"accountNumber\": \"1234567890\",\n  \"ifscCode\": \"SBIN0001234\",\n  \"bankName\": \"State Bank of India\",\n  \"upiId\": \"society@sbi\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": "{{baseUrl}}/societies/{{societyId}}/bank-account"
          }
        },
        {
          "name": "Get Bank Account",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": "{{baseUrl}}/societies/{{societyId}}/bank-account"
          }
        }
      ]
    },
    {
      "name": "Payment Upload",
      "item": [
        {
          "name": "Upload Payment Reference",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"referenceNo\": \"UTR123456789\",\n  \"transactionDate\": \"2024-02-23T10:30:00Z\",\n  \"amount\": 5000.00,\n  \"remarks\": \"Payment via NEFT\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": "{{baseUrl}}/societies/{{societyId}}/invoices/{{invoiceId}}/payment-upload"
          }
        },
        {
          "name": "Get Payment Uploads",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/societies/{{societyId}}/payment-uploads?verificationStatus=PENDING",
              "host": ["{{baseUrl}}"],
              "path": ["societies", "{{societyId}}", "payment-uploads"],
              "query": [
                {
                  "key": "verificationStatus",
                  "value": "PENDING"
                }
              ]
            }
          }
        },
        {
          "name": "Verify Payment",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"verificationStatus\": \"APPROVED\",\n  \"verificationNotes\": \"Verified from bank statement\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": "{{baseUrl}}/societies/{{societyId}}/payment-uploads/{{uploadId}}/verify"
          }
        }
      ]
    }
  ]
}
```

## Notes

- Replace placeholders with actual values
- Ensure you have valid authentication token
- Test in sequence: create bank account → generate invoice → upload payment → verify
- Check audit logs after each operation
- Verify invoice status updates after payment approval
