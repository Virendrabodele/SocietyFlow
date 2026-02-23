import { Router } from 'express';
import {
  createBillingHead,
  getBillingHeads,
  createLineItem,
  updateLineItem,
  deleteLineItem,
} from '../controllers/billing.controller';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  createBillingHeadSchema,
  createLineItemSchema,
  updateLineItemSchema,
} from '../types/billing.schema';

const router = Router();

// All routes require authentication and society access
router.use(authenticate);
router.use(verifySocietyAccess);

router.post('/:id/billing-heads', validate(createBillingHeadSchema), createBillingHead);
router.get('/:id/billing-heads', getBillingHeads);
router.post(
  '/:id/billing-heads/:headId/line-items',
  validate(createLineItemSchema),
  createLineItem
);
router.patch('/:id/line-items/:lineItemId', validate(updateLineItemSchema), updateLineItem);
router.delete('/:id/line-items/:lineItemId', deleteLineItem);

export default router;
