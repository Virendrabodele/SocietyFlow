# Bank Account Payment Flow (No Gateway)

This document describes the bank account-based payment collection flow implemented in SocietyFlow.

## Overview

Since we don't have a payment gateway integration, this implementation provides a structured workflow for:
1. Society admins to configure bank account details
2. Invoice pages to show bank account information
3. Residents to upload payment references after making bank transfers
4. Committee members to verify payment references and issue receipts

## Database Schema

### BankAccount Model
Stores society bank account information:
- `accountName`: Account holder name
- `accountNumber`: Bank account number
- `ifscCode`: IFSC code (validated format)
- `bankName`: Name of the bank
- `branchName`: Optional branch name
- `upiId`: Optional UPI ID for UPI payments
- `qrCodeUrl`: Optional URL to UPI QR code image

### PaymentUploadReference Model
Stores payment references uploaded by residents:
- `referenceNo`: Transaction reference number (UTR/UPI ref)
- `transactionDate`: Date of transaction
- `amount`: Amount paid
- `remarks`: Optional remarks
- `fileUrl`: Optional URL to payment screenshot/proof
- `verificationStatus`: PENDING | APPROVED | REJECTED
- `verifiedBy`: User who verified the payment
- `verifiedAt`: Verification timestamp
- `verificationNotes`: Notes from verifier

## API Endpoints

### Bank Account Management

#### Create Bank Account
```http
POST /api/v1/societies/:id/bank-account
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountName": "ABC Society",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "bankName": "State Bank of India",
  "branchName": "Main Branch",
  "upiId": "society@sbi",
  "qrCodeUrl": "https://example.com/qr.png"
}
```

#### Get Bank Account
```http
GET /api/v1/societies/:id/bank-account
Authorization: Bearer <token>

Response: Bank account details with masked account number (****1234)
```

#### Update Bank Account
```http
PUT /api/v1/societies/:id/bank-account
Authorization: Bearer <token>
Content-Type: application/json

{
  "upiId": "newsociety@paytm",
  "qrCodeUrl": "https://example.com/new-qr.png"
}
```

#### Delete Bank Account
```http
DELETE /api/v1/societies/:id/bank-account
Authorization: Bearer <token>
```

### Payment Upload Flow

#### Upload Payment Reference
```http
POST /api/v1/societies/:id/invoices/:invoiceId/payment-upload
Authorization: Bearer <token>
Content-Type: application/json

{
  "referenceNo": "UTR123456789",
  "transactionDate": "2024-02-23T10:30:00Z",
  "amount": 5000.00,
  "remarks": "Paid via NEFT",
  "fileUrl": "https://example.com/payment-proof.png"
}
```

#### Get Payment Uploads
```http
GET /api/v1/societies/:id/payment-uploads?verificationStatus=PENDING
Authorization: Bearer <token>

Query Parameters:
- invoiceId: Filter by invoice ID
- verificationStatus: PENDING | APPROVED | REJECTED
```

#### Verify Payment Reference
```http
POST /api/v1/societies/:id/payment-uploads/:uploadId/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "verificationStatus": "APPROVED",
  "verificationNotes": "Payment verified from bank statement"
}
```

**Note**: When a payment reference is APPROVED:
1. A Payment record is automatically created
2. Invoice status is updated (PAID or PARTIALLY_PAID)
3. Audit log is created

### Enhanced Invoice Details

The invoice details endpoint now includes:
- Bank account information (from society.bankAccount)
- Payment upload references (paymentUploads)

```http
GET /api/v1/societies/:id/invoices/:invoiceId
Authorization: Bearer <token>

Response includes:
{
  "id": "...",
  "totalAmount": 5000,
  "society": {
    "bankAccount": {
      "accountName": "ABC Society",
      "accountNumber": "****1234",
      "ifscCode": "SBIN0001234",
      ...
    }
  },
  "paymentUploads": [
    {
      "id": "...",
      "referenceNo": "UTR123456",
      "verificationStatus": "PENDING",
      ...
    }
  ]
}
```

## UPI Deep Link Generation

The `payment-helper.ts` utility provides functions for generating UPI deep links:

```typescript
import { generateUpiDeepLink } from './utils/payment-helper';

const upiLink = generateUpiDeepLink({
  upiId: 'society@paytm',
  payeeName: 'ABC Society',
  amount: 5000.00,
  transactionNote: 'Maintenance for Unit 101',
  transactionRef: 'INV-2024-001'
});

// Result: upi://pay?pa=society@paytm&pn=ABC%20Society&am=5000.00&cu=INR&tn=Maintenance...
```

## Frontend Integration Guide

### 1. Invoice Page - Pay Now Button

```javascript
// Fetch invoice details with bank account
const invoice = await fetch(`/api/v1/societies/${societyId}/invoices/${invoiceId}`);
const { totalAmount, society: { bankAccount }, paymentUploads } = await invoice.json();

// If UPI ID exists, generate UPI deep link
if (bankAccount.upiId) {
  const upiLink = `upi://pay?pa=${bankAccount.upiId}&pn=${encodeURIComponent(bankAccount.accountName)}&am=${totalAmount}&cu=INR`;

  // Show "Pay with UPI" button
  <a href={upiLink} className="btn-pay-upi">Pay ₹{totalAmount} with UPI</a>
}

// Always show bank transfer details
<div className="bank-details">
  <h3>Bank Transfer Details</h3>
  <p>Account Name: {bankAccount.accountName}</p>
  <p>Account Number: {bankAccount.accountNumber}</p>
  <p>IFSC Code: {bankAccount.ifscCode}</p>
  <p>Bank: {bankAccount.bankName}</p>

  {bankAccount.qrCodeUrl && (
    <img src={bankAccount.qrCodeUrl} alt="UPI QR Code" />
  )}

  <button onClick={copyBankDetails}>Copy Details</button>
</div>

// Show upload payment reference button
<button onClick={openUploadModal}>I've Made the Payment</button>
```

### 2. Upload Payment Reference Modal

```javascript
const uploadPaymentReference = async (formData) => {
  const response = await fetch(
    `/api/v1/societies/${societyId}/invoices/${invoiceId}/payment-upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        referenceNo: formData.referenceNo,
        transactionDate: formData.transactionDate,
        amount: formData.amount,
        remarks: formData.remarks,
        fileUrl: formData.fileUrl // After uploading file to storage
      })
    }
  );

  if (response.ok) {
    alert('Payment reference uploaded successfully! Awaiting verification.');
  }
};
```

### 3. Committee Dashboard - Verify Payments

```javascript
// Fetch pending payment uploads
const pendingPayments = await fetch(
  `/api/v1/societies/${societyId}/payment-uploads?verificationStatus=PENDING`
);

// Display list with verify/reject buttons
<table>
  {pendingPayments.map(upload => (
    <tr key={upload.id}>
      <td>{upload.invoice.member.name} - Unit {upload.invoice.member.unitNo}</td>
      <td>₹{upload.amount}</td>
      <td>{upload.referenceNo}</td>
      <td>{upload.transactionDate}</td>
      <td>
        <button onClick={() => verifyPayment(upload.id, 'APPROVED')}>
          Approve
        </button>
        <button onClick={() => verifyPayment(upload.id, 'REJECTED')}>
          Reject
        </button>
      </td>
    </tr>
  ))}
</table>

const verifyPayment = async (uploadId, status) => {
  const notes = prompt('Verification notes:');

  await fetch(
    `/api/v1/societies/${societyId}/payment-uploads/${uploadId}/verify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        verificationStatus: status,
        verificationNotes: notes
      })
    }
  );
};
```

## Workflow Diagram

```
1. Admin Setup
   └─> Admin configures bank account in Society Settings
       └─> Bank details stored with masked account number

2. Invoice Generation
   └─> System generates invoices for all members
       └─> Invoice includes reference to society bank account

3. Resident Payment Flow
   ├─> Option A: UPI Payment
   │   └─> Click "Pay with UPI" button
   │       └─> UPI app opens with pre-filled details
   │       └─> Resident completes payment in UPI app
   │       └─> Resident uploads UPI reference number
   │
   └─> Option B: Bank Transfer
       └─> View bank account details
       └─> Copy details or scan QR code
       └─> Make bank transfer
       └─> Upload UTR number and screenshot

4. Committee Verification
   └─> Committee member views pending payment uploads
       └─> Verifies payment with bank statement
       ├─> If valid: Approve
       │   └─> System creates Payment record
       │   └─> Updates Invoice status
       │   └─> Can generate Receipt
       │
       └─> If invalid: Reject
           └─> Resident notified to re-upload correct details

5. Receipt Generation
   └─> After payment verified, committee generates receipt
       └─> Receipt linked to invoice and payment
```

## Security Considerations

1. **Account Number Masking**: Account numbers are masked (****1234) in GET responses
2. **File Upload**: Payment proof files should be uploaded to secure storage (S3, etc.)
3. **Verification**: Only committee members with appropriate permissions can verify payments
4. **Audit Trail**: All actions are logged via audit logs
5. **Input Validation**: Zod schemas validate all inputs including IFSC code format

## Testing

### Manual Testing Checklist

- [ ] Create bank account for a society
- [ ] Fetch bank account details (verify masking)
- [ ] Update bank account (UPI ID, QR code)
- [ ] Generate invoices
- [ ] Fetch invoice with bank account details
- [ ] Upload payment reference with UTR
- [ ] Upload payment reference with file URL
- [ ] List pending payment uploads
- [ ] Approve payment upload
- [ ] Verify invoice status updated to PAID/PARTIALLY_PAID
- [ ] Verify Payment record created
- [ ] Reject payment upload
- [ ] Delete bank account
- [ ] Verify audit logs for all actions

## Future Enhancements

1. **Payment Gateway Integration**: When ready, add gateway support alongside bank transfer
2. **Automated Verification**: Integrate with bank APIs for automated UTR verification
3. **Reminders**: Send automated reminders for pending payments
4. **Bulk Upload**: Allow committee to upload bank statement CSV for batch verification
5. **Payment Plans**: Support installment payments
6. **Late Fees**: Automatic calculation of late fees
7. **Mobile App**: Deep linking for UPI payments from mobile app

## Migration Notes

When deploying this feature:

1. Run Prisma migration to create new tables:
   ```bash
   npm run prisma:migrate
   ```

2. Existing societies need to add bank account information:
   - Navigate to Society Settings
   - Add bank account details
   - Upload UPI QR code if available

3. Inform residents about new payment flow:
   - Payment via bank transfer or UPI
   - Upload payment reference after payment
   - Wait for committee verification
