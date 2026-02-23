import { Router } from 'express';
import {
  createSociety,
  getSocieties,
  grantSocietyAccess,
  getSocietyAccess,
} from '../controllers/society.controller';
import { authenticate, authorize } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import { createSocietySchema, grantAccessSchema } from '../types/society.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', authorize('MASTER_ADMIN'), validate(createSocietySchema), createSociety);
router.get('/', getSocieties);
router.post('/:id/access', verifySocietyAccess, validate(grantAccessSchema), grantSocietyAccess);
router.get('/:id/access', verifySocietyAccess, getSocietyAccess);

export default router;
