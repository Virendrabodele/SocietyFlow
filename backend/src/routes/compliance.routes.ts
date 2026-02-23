import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  getTaxConfiguration,
  updateTaxConfiguration,
  updateSocietyCompliance,
  getInvoiceSeriesConfiguration,
  updateInvoiceSeriesConfiguration,
  getReceiptSeriesConfiguration,
  updateReceiptSeriesConfiguration,
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

// Tax configuration
router.get('/:id/tax/config', verifySocietyAccess, getTaxConfiguration);
router.post(
  '/:id/tax/config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(createTaxConfigSchema),
  updateTaxConfiguration
);
router.put(
  '/:id/tax/config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateTaxConfigSchema),
  updateTaxConfiguration
);

// Society compliance information
router.put(
  '/:id/compliance',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateSocietyComplianceSchema),
  updateSocietyCompliance
);

// Invoice series configuration
router.get('/:id/invoice-series/config', verifySocietyAccess, getInvoiceSeriesConfiguration);
router.post(
  '/:id/invoice-series/config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  updateInvoiceSeriesConfiguration
);

// Receipt series configuration
router.get('/:id/receipt-series/config', verifySocietyAccess, getReceiptSeriesConfiguration);
router.post(
  '/:id/receipt-series/config',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  updateReceiptSeriesConfiguration
);

// Receipt sequence (India FY-aware)
router.get('/:id/receipt-sequence', verifySocietyAccess, getReceiptSequenceConfig);
router.post(
  '/:id/receipt-sequence',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(configureReceiptSequenceSchema),
  configureReceiptSequenceHandler
);
router.post(
  '/:id/receipt-sequence/generate',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'COMMITTEE_USER'),
  verifySocietyAccess,
  generateReceiptNumberHandler
);

// Month closure management
router.get('/:id/month-closures', verifySocietyAccess, getMonthClosures);
router.post(
  '/:id/month-closures',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(createMonthClosureSchema),
  upsertMonthClosure
);
router.put(
  '/:id/month-closures/:closureId',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  validate(updateMonthClosureStatusSchema),
  updateMonthClosureStatus
);

// Audit logs
router.get(
  '/:id/audit-logs',
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN'),
  verifySocietyAccess,
  getAuditLogs
);

export default router;
