import { z } from 'zod';

export const generateInvoicesSchema = z.object({
  query: z.object({
    month: z.string().regex(/^(1[0-2]|[1-9])$/, 'Month must be between 1 and 12'),
    year: z.string().regex(/^\d{4}$/, 'Year must be a 4-digit number'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    amountPaid: z.number().positive('Amount must be positive'),
    paidOn: z.string().datetime('Invalid date format'),
    mode: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD', 'OTHER']),
    referenceNo: z.string().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    invoiceId: z.string().uuid('Invalid invoice ID'),
  }),
});

export const createReceiptSchema = z.object({
  body: z.object({
    receiptNo: z.string().min(1, 'Receipt number is required'),
    issuedOn: z.string().datetime('Invalid date format'),
    fileUrl: z.string().url().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    invoiceId: z.string().uuid('Invalid invoice ID'),
  }),
});

export const sendNotificationSchema = z.object({
  body: z.object({
    channels: z.array(z.enum(['EMAIL', 'SMS'])),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    invoiceId: z.string().uuid('Invalid invoice ID'),
  }),
});
