import { Router } from 'express';
import {
  generateInvoices,
  getInvoices,
  getInvoiceDetails,
  createPayment,
  createReceipt,
  getReceipts,
  cancelReceipt,
} from '../controllers/invoice.controller';
import { sendInvoiceNotifications } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  generateInvoicesSchema,
  createPaymentSchema,
  createReceiptSchema,
  sendNotificationSchema,
} from '../types/invoice.schema';

const router = Router();

// All routes require authentication and society access
router.use(authenticate);
router.use(verifySocietyAccess);

// Invoice routes
router.post('/:id/invoices/generate', validate(generateInvoicesSchema), generateInvoices);
router.get('/:id/invoices', getInvoices);
router.get('/:id/invoices/:invoiceId', getInvoiceDetails);

// Payment routes
router.post('/:id/invoices/:invoiceId/payments', validate(createPaymentSchema), createPayment);

// Receipt routes
router.post('/:id/invoices/:invoiceId/receipt', validate(createReceiptSchema), createReceipt);
router.get('/:id/receipts', getReceipts);
router.post('/:id/receipts/:receiptId/cancel', cancelReceipt);

// Notification routes
router.post(
  '/:id/invoices/:invoiceId/send',
  validate(sendNotificationSchema),
  sendInvoiceNotifications
);

export default router;
