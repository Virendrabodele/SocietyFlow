import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  getResidentDashboardSchema,
  getResidentInvoicesSchema,
  getResidentReceiptsSchema,
  getResidentPaymentsSchema,
} from '../types/payment.schema';
import {
  getResidentDashboard,
  getResidentInvoices,
  getResidentReceipts,
  getResidentPayments,
  getResidentProfile,
} from '../controllers/resident.controller';

const router = Router();

// ============================================
// RESIDENT PORTAL ROUTES
// ============================================

// All routes require RESIDENT role
const residentAuth = [authenticate, authorize('RESIDENT')];

// Get resident dashboard
router.get(
  '/me/dashboard',
  ...residentAuth,
  validate(getResidentDashboardSchema),
  getResidentDashboard
);

// Get resident invoices
router.get(
  '/me/invoices',
  ...residentAuth,
  validate(getResidentInvoicesSchema),
  getResidentInvoices
);

// Get resident receipts
router.get(
  '/me/receipts',
  ...residentAuth,
  validate(getResidentReceiptsSchema),
  getResidentReceipts
);

// Get resident payment history
router.get(
  '/me/payments',
  ...residentAuth,
  validate(getResidentPaymentsSchema),
  getResidentPayments
);

// Get resident profile
router.get(
  '/me/profile',
  ...residentAuth,
  getResidentProfile
);

export default router;
