import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import {
  getTaxConfiguration,
  updateTaxConfiguration,
  getInvoiceSeriesConfiguration,
  updateInvoiceSeriesConfiguration,
  getReceiptSeriesConfiguration,
  updateReceiptSeriesConfiguration,
} from '../controllers/compliance.controller';

const router = Router({ mergeParams: true });

// Tax configuration
router.get('/:id/tax/config', authenticate, verifySocietyAccess, getTaxConfiguration);
router.post('/:id/tax/config', authenticate, verifySocietyAccess, updateTaxConfiguration);

// Invoice series configuration
router.get('/:id/invoice-series/config', authenticate, verifySocietyAccess, getInvoiceSeriesConfiguration);
router.post('/:id/invoice-series/config', authenticate, verifySocietyAccess, updateInvoiceSeriesConfiguration);

// Receipt series configuration
router.get('/:id/receipt-series/config', authenticate, verifySocietyAccess, getReceiptSeriesConfiguration);
router.post('/:id/receipt-series/config', authenticate, verifySocietyAccess, updateReceiptSeriesConfiguration);

export default router;
