import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  getTaxConfig,
  upsertTaxConfig,
  updateSocietyCompliance,
  configureReceiptSequenceHandler,
  getReceiptSequenceConfig,
  generateReceiptNumberHandler,
  upsertMonthClosure,
  updateMonthClosureStatus,
  getMonthClosures,
  getAuditLogs,
} from '../controllers/compliance.controller';
import {
  createTaxConfigSchema,
  updateTaxConfigSchema,
  updateSocietyComplianceSchema,
  configureReceiptSequenceSchema,
  createMonthClosureSchema,
  updateMonthClosureStatusSchema,
} from '../types/compliance.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Tax Configuration Routes
router.get(
  '/societies/:id/tax-config',
  verifySocietyAccess,
  getTaxConfig
);

router.post(
  '/societies/:id/tax-config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(createTaxConfigSchema),
  upsertTaxConfig
);

router.put(
  '/societies/:id/tax-config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateTaxConfigSchema),
  upsertTaxConfig
);

// Society Compliance Information
router.put(
  '/societies/:id/compliance',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateSocietyComplianceSchema),
  updateSocietyCompliance
);

// Receipt Sequence Configuration
router.get(
  '/societies/:id/receipt-sequence',
  verifySocietyAccess,
  getReceiptSequenceConfig
);

router.post(
  '/societies/:id/receipt-sequence',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(configureReceiptSequenceSchema),
  configureReceiptSequenceHandler
);

router.post(
  '/societies/:id/receipt-sequence/generate',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'COMMITTEE_USER'),
  verifySocietyAccess,
  generateReceiptNumberHandler
);

// Month Closure Management
router.get(
  '/societies/:id/month-closures',
  verifySocietyAccess,
  getMonthClosures
);

router.post(
  '/societies/:id/month-closures',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(createMonthClosureSchema),
  upsertMonthClosure
);

router.put(
  '/societies/:id/month-closures/:closureId',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateMonthClosureStatusSchema),
  updateMonthClosureStatus
);

// Audit Logs
router.get(
  '/societies/:id/audit-logs',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  getAuditLogs
);

export default router;
