/**
 * Payment Flow - Frontend Helper Functions
 *
 * This file contains helper functions for implementing the bank account payment flow
 * in the frontend application.
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BankAccount {
  id: string;
  societyId: string;
  accountName: string;
  accountNumber: string; // Masked: ****1234
  ifscCode: string;
  bankName: string;
  branchName?: string;
  upiId?: string;
  qrCodeUrl?: string;
  isActive: boolean;
}

interface PaymentUploadReference {
  id: string;
  invoiceId: string;
  referenceNo?: string;
  transactionDate: string;
  amount: number;
  remarks?: string;
  fileUrl?: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  };
  verifiedAt?: string;
  verificationNotes?: string;
}

interface InvoiceWithBankAccount {
  id: string;
  totalAmount: number;
  status: string;
  society: {
    id: string;
    name: string;
    bankAccount?: BankAccount;
  };
  paymentUploads: PaymentUploadReference[];
}

// ============================================
// UPI DEEP LINK GENERATION
// ============================================

/**
 * Generates a UPI deep link for payment
 */
export function generateUpiDeepLink(
  upiId: string,
  payeeName: string,
  amount: number,
  transactionNote?: string,
  transactionRef?: string
): string {
  let upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}`;
  upiUrl += `&pn=${encodeURIComponent(payeeName)}`;
  upiUrl += `&am=${amount.toFixed(2)}`;
  upiUrl += '&cu=INR';

  if (transactionNote) {
    upiUrl += `&tn=${encodeURIComponent(transactionNote)}`;
  }

  if (transactionRef) {
    upiUrl += `&tr=${encodeURIComponent(transactionRef)}`;
  }

  return upiUrl;
}

/**
 * Opens UPI app with payment details
 */
export function openUpiPayment(
  upiId: string,
  payeeName: string,
  amount: number,
  invoiceId: string
): void {
  const upiLink = generateUpiDeepLink(
    upiId,
    payeeName,
    amount,
    `Payment for invoice ${invoiceId}`,
    invoiceId
  );

  // For web: Create a temporary link and trigger click
  const link = document.createElement('a');
  link.href = upiLink;
  link.click();

  // For mobile web: Direct window location change
  // window.location.href = upiLink;
}

// ============================================
// BANK DETAILS HELPERS
// ============================================

/**
 * Formats bank details as plain text for copying
 */
export function formatBankDetailsForCopy(bankAccount: BankAccount, amount?: number): string {
  let text = `Bank Account Details\n`;
  text += `${'='.repeat(30)}\n\n`;
  text += `Account Name: ${bankAccount.accountName}\n`;
  text += `Account Number: ${bankAccount.accountNumber}\n`;
  text += `IFSC Code: ${bankAccount.ifscCode}\n`;
  text += `Bank Name: ${bankAccount.bankName}\n`;

  if (bankAccount.branchName) {
    text += `Branch: ${bankAccount.branchName}\n`;
  }

  if (amount) {
    text += `\nAmount to Pay: ₹${amount.toFixed(2)}\n`;
  }

  if (bankAccount.upiId) {
    text += `\nUPI ID: ${bankAccount.upiId}\n`;
  }

  return text;
}

/**
 * Copies bank details to clipboard
 */
export async function copyBankDetailsToClipboard(
  bankAccount: BankAccount,
  amount?: number
): Promise<boolean> {
  try {
    const text = formatBankDetailsForCopy(bankAccount, amount);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Copies a specific field to clipboard
 */
export async function copyFieldToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetches invoice details with bank account information
 */
export async function fetchInvoiceWithBankAccount(
  societyId: string,
  invoiceId: string,
  token: string
): Promise<InvoiceWithBankAccount> {
  const response = await fetch(
    `/api/v1/societies/${societyId}/invoices/${invoiceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch invoice');
  }

  return response.json();
}

/**
 * Uploads payment reference after making payment
 */
export async function uploadPaymentReference(
  societyId: string,
  invoiceId: string,
  data: {
    referenceNo?: string;
    transactionDate: string;
    amount: number;
    remarks?: string;
    fileUrl?: string;
  },
  token: string
): Promise<PaymentUploadReference> {
  const response = await fetch(
    `/api/v1/societies/${societyId}/invoices/${invoiceId}/payment-upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload payment reference');
  }

  return response.json();
}

/**
 * Fetches all payment uploads (for committee dashboard)
 */
export async function fetchPaymentUploads(
  societyId: string,
  token: string,
  filters?: {
    invoiceId?: string;
    verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }
): Promise<PaymentUploadReference[]> {
  const params = new URLSearchParams();
  if (filters?.invoiceId) params.append('invoiceId', filters.invoiceId);
  if (filters?.verificationStatus) params.append('verificationStatus', filters.verificationStatus);

  const response = await fetch(
    `/api/v1/societies/${societyId}/payment-uploads?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch payment uploads');
  }

  return response.json();
}

/**
 * Verifies or rejects a payment reference (committee only)
 */
export async function verifyPaymentReference(
  societyId: string,
  uploadId: string,
  verificationStatus: 'APPROVED' | 'REJECTED',
  verificationNotes: string,
  token: string
): Promise<PaymentUploadReference> {
  const response = await fetch(
    `/api/v1/societies/${societyId}/payment-uploads/${uploadId}/verify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verificationStatus,
        verificationNotes,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to verify payment reference');
  }

  return response.json();
}

/**
 * Fetches bank account for a society
 */
export async function fetchBankAccount(
  societyId: string,
  token: string
): Promise<BankAccount> {
  const response = await fetch(
    `/api/v1/societies/${societyId}/bank-account`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch bank account');
  }

  return response.json();
}

/**
 * Creates or updates bank account for a society (admin only)
 */
export async function saveBankAccount(
  societyId: string,
  data: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName?: string;
    upiId?: string;
    qrCodeUrl?: string;
  },
  token: string,
  isUpdate: boolean = false
): Promise<BankAccount> {
  const response = await fetch(
    `/api/v1/societies/${societyId}/bank-account`,
    {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to save bank account');
  }

  return response.json();
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates IFSC code format
 */
export function isValidIfscCode(ifscCode: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifscCode);
}

/**
 * Validates UPI ID format
 */
export function isValidUpiId(upiId: string): boolean {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
}

/**
 * Validates UTR number format (typical format)
 */
export function isValidUtrNumber(utr: string): boolean {
  // UTR typically has 16-22 alphanumeric characters
  return /^[A-Z0-9]{10,22}$/.test(utr);
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Gets status badge color for verification status
 */
export function getVerificationStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'warning'; // yellow
    case 'APPROVED':
      return 'success'; // green
    case 'REJECTED':
      return 'error'; // red
    default:
      return 'default'; // gray
  }
}

/**
 * Gets user-friendly status label
 */
export function getVerificationStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Awaiting Verification';
    case 'APPROVED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

/**
 * Formats currency amount
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats date to readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ============================================
// EXAMPLE USAGE IN REACT COMPONENTS
// ============================================

/*
// Example: Invoice Payment Page Component

import React, { useState, useEffect } from 'react';
import {
  fetchInvoiceWithBankAccount,
  openUpiPayment,
  copyBankDetailsToClipboard,
  uploadPaymentReference,
  formatCurrency,
} from './payment-helpers';

function InvoicePaymentPage({ societyId, invoiceId, token }) {
  const [invoice, setInvoice] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchInvoiceWithBankAccount(societyId, invoiceId, token)
      .then(setInvoice)
      .catch(console.error);
  }, [societyId, invoiceId, token]);

  if (!invoice) return <div>Loading...</div>;

  const { totalAmount, society: { bankAccount } } = invoice;

  const handleUpiPayment = () => {
    if (bankAccount?.upiId) {
      openUpiPayment(
        bankAccount.upiId,
        bankAccount.accountName,
        totalAmount,
        invoiceId
      );
      // Show upload modal after UPI payment
      setTimeout(() => setShowUploadModal(true), 2000);
    }
  };

  const handleCopyDetails = async () => {
    const success = await copyBankDetailsToClipboard(bankAccount, totalAmount);
    if (success) {
      alert('Bank details copied to clipboard!');
    }
  };

  return (
    <div className="invoice-payment">
      <h2>Pay Invoice</h2>
      <p>Amount: {formatCurrency(totalAmount)}</p>

      {bankAccount?.upiId && (
        <button onClick={handleUpiPayment} className="btn-pay-upi">
          Pay ₹{totalAmount} with UPI
        </button>
      )}

      <div className="bank-details">
        <h3>Bank Transfer Details</h3>
        <p>Account Name: {bankAccount?.accountName}</p>
        <p>Account Number: {bankAccount?.accountNumber}</p>
        <p>IFSC Code: {bankAccount?.ifscCode}</p>
        <p>Bank: {bankAccount?.bankName}</p>

        {bankAccount?.qrCodeUrl && (
          <img src={bankAccount.qrCodeUrl} alt="UPI QR Code" />
        )}

        <button onClick={handleCopyDetails}>Copy Details</button>
      </div>

      <button onClick={() => setShowUploadModal(true)}>
        I've Made the Payment
      </button>

      {showUploadModal && (
        <UploadPaymentModal
          societyId={societyId}
          invoiceId={invoiceId}
          token={token}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
*/
