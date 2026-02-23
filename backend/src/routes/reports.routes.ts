import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import {
  getMonthEndReport,
  getTaxSummaryReport,
  getCollectionSummaryReport,
  getAuditLogs,
  getFinancialEventsReport,
} from '../controllers/reports.controller';

const router = Router({ mergeParams: true });

// Month-end reports
router.get('/:id/reports/month-end', authenticate, verifySocietyAccess, getMonthEndReport);
router.get('/:id/reports/tax-summary', authenticate, verifySocietyAccess, getTaxSummaryReport);
router.get('/:id/reports/collection-summary', authenticate, verifySocietyAccess, getCollectionSummaryReport);

// Audit reports
router.get('/:id/audit/logs', authenticate, verifySocietyAccess, getAuditLogs);
router.get('/:id/audit/financial-events', authenticate, verifySocietyAccess, getFinancialEventsReport);

export default router;
