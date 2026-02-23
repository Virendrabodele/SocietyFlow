import { z } from 'zod';

export const createBankAccountSchema = z.object({
  body: z.object({
    accountName: z.string().min(1, 'Account name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    ifscCode: z
      .string()
      .min(11, 'IFSC code must be 11 characters')
      .max(11, 'IFSC code must be 11 characters')
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
    bankName: z.string().min(1, 'Bank name is required'),
    branchName: z.string().optional(),
    upiId: z.string().optional(),
    qrCodeUrl: z.string().url('Invalid QR code URL').optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const updateBankAccountSchema = z.object({
  body: z.object({
    accountName: z.string().min(1, 'Account name is required').optional(),
    accountNumber: z.string().min(1, 'Account number is required').optional(),
    ifscCode: z
      .string()
      .min(11, 'IFSC code must be 11 characters')
      .max(11, 'IFSC code must be 11 characters')
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format')
      .optional(),
    bankName: z.string().min(1, 'Bank name is required').optional(),
    branchName: z.string().optional(),
    upiId: z.string().optional(),
    qrCodeUrl: z.string().url('Invalid QR code URL').optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const uploadPaymentReferenceSchema = z.object({
  body: z.object({
    referenceNo: z.string().optional(),
    transactionDate: z.string().datetime('Invalid transaction date'),
    amount: z.number().positive('Amount must be positive'),
    remarks: z.string().optional(),
    fileUrl: z.string().url('Invalid file URL').optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    invoiceId: z.string().uuid('Invalid invoice ID'),
  }),
});

export const verifyPaymentReferenceSchema = z.object({
  body: z.object({
    verificationStatus: z.enum(['APPROVED', 'REJECTED']),
    verificationNotes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    uploadId: z.string().uuid('Invalid upload ID'),
  }),
});
