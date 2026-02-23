import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  createBankAccountSchema,
  getBankAccountsSchema,
  updateBankAccountSchema,
  submitPaymentSchema,
  verifyPaymentSubmissionSchema,
  getPaymentSubmissionsSchema,
} from '../types/payment.schema';
import {
  createBankAccount,
  getBankAccounts,
  getBankAccountDetails,
  updateBankAccount,
  submitPayment,
  verifyPaymentSubmission,
  getPaymentSubmissions,
  getPaymentSubmissionById,
} from '../controllers/payment.controller';

const router = Router();

// ============================================
// BANK ACCOUNT ROUTES
// ============================================

// Create bank account (Admin/Treasurer only)
router.post(
  '/:id/bank-accounts',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  validate(createBankAccountSchema),
  createBankAccount
);

// Get all bank accounts
router.get(
  '/:id/bank-accounts',
  authenticate,
  verifySocietyAccess,
  validate(getBankAccountsSchema),
  getBankAccounts
);

// Get full bank account details (for payment instructions)
router.get(
  '/:id/bank-accounts/:accountId',
  authenticate,
  verifySocietyAccess,
  getBankAccountDetails
);

// Update bank account
router.patch(
  '/:id/bank-accounts/:accountId',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  validate(updateBankAccountSchema),
  updateBankAccount
);

// ============================================
// PAYMENT SUBMISSION ROUTES
// ============================================

// Submit payment proof for invoice
router.post(
  '/:id/invoices/:invoiceId/payment-submit',
  authenticate,
  verifySocietyAccess,
  validate(submitPaymentSchema),
  submitPayment
);

// Verify/reject payment submission
router.post(
  '/:id/payment-submissions/:submissionId/verify',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER', 'COMMITTEE_USER'),
  verifySocietyAccess,
  validate(verifyPaymentSubmissionSchema),
  verifyPaymentSubmission
);

// Get all payment submissions for a society
router.get(
  '/:id/payment-submissions',
  authenticate,
  verifySocietyAccess,
  validate(getPaymentSubmissionsSchema),
  getPaymentSubmissions
);

// Get specific payment submission
router.get(
  '/:id/payment-submissions/:submissionId',
  authenticate,
  verifySocietyAccess,
  getPaymentSubmissionById
);

export default router;
