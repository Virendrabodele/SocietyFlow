import { Router } from 'express';
import {
  createBankAccount,
  getBankAccount,
  updateBankAccount,
  deleteBankAccount,
  uploadPaymentReference,
  verifyPaymentReference,
  getPaymentUploads,
} from '../controllers/bank-account.controller';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  uploadPaymentReferenceSchema,
  verifyPaymentReferenceSchema,
} from '../types/bank-account.schema';

const router = Router();

// All routes require authentication and society access
router.use(authenticate);
router.use(verifySocietyAccess);

// Bank account routes
router.post('/:id/bank-account', validate(createBankAccountSchema), createBankAccount);
router.get('/:id/bank-account', getBankAccount);
router.put('/:id/bank-account', validate(updateBankAccountSchema), updateBankAccount);
router.delete('/:id/bank-account', deleteBankAccount);

// Payment upload routes
router.post(
  '/:id/invoices/:invoiceId/payment-upload',
  validate(uploadPaymentReferenceSchema),
  uploadPaymentReference
);
router.get('/:id/payment-uploads', getPaymentUploads);
router.post(
  '/:id/payment-uploads/:uploadId/verify',
  validate(verifyPaymentReferenceSchema),
  verifyPaymentReference
);

export default router;
