/**
 * UPI Deep Link Generator
 * Generates UPI payment links that can be used to trigger UPI apps
 */

interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}

/**
 * Generates a UPI deep link
 * Format: upi://pay?pa=<UPI_ID>&pn=<Payee_Name>&am=<Amount>&tn=<Transaction_Note>&tr=<Transaction_Ref>
 */
export const generateUpiDeepLink = (params: UpiPaymentParams): string => {
  const { upiId, payeeName, amount, transactionNote, transactionRef } = params;

  // Build the UPI URL
  let upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}`;
  upiUrl += `&pn=${encodeURIComponent(payeeName)}`;
  upiUrl += `&am=${amount.toFixed(2)}`;
  upiUrl += '&cu=INR'; // Currency: Indian Rupees

  if (transactionNote) {
    upiUrl += `&tn=${encodeURIComponent(transactionNote)}`;
  }

  if (transactionRef) {
    upiUrl += `&tr=${encodeURIComponent(transactionRef)}`;
  }

  return upiUrl;
};

/**
 * Generates a UPI intent link (alternative format for some apps)
 * Format: upi://pay?pa=<UPI_ID>&pn=<Payee_Name>&am=<Amount>&tn=<Transaction_Note>&tr=<Transaction_Ref>
 */
export const generateUpiIntentLink = (params: UpiPaymentParams): string => {
  // For most cases, intent link is the same as deep link
  return generateUpiDeepLink(params);
};

/**
 * Validates a UPI ID format
 * Format: username@bankname
 */
export const isValidUpiId = (upiId: string): boolean => {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
};

/**
 * Generates payment details for bank transfer
 */
export interface BankTransferDetails {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  amount: number;
  referenceNote?: string;
}

export const formatBankTransferDetails = (details: BankTransferDetails): string => {
  let text = `Account Name: ${details.accountName}\n`;
  text += `Account Number: ${details.accountNumber}\n`;
  text += `IFSC Code: ${details.ifscCode}\n`;
  text += `Bank Name: ${details.bankName}\n`;

  if (details.branchName) {
    text += `Branch: ${details.branchName}\n`;
  }

  text += `Amount: ₹${details.amount.toFixed(2)}\n`;

  if (details.referenceNote) {
    text += `Reference: ${details.referenceNote}`;
  }

  return text;
};

/**
 * Mask account number for display (show only last 4 digits)
 */
export const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 4) {
    return accountNumber;
  }
  return `****${accountNumber.slice(-4)}`;
};
