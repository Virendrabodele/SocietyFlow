import { Router } from 'express';
import {
  createMember,
  bulkCreateMembers,
  getMembers,
  updateMember,
  deleteMember,
} from '../controllers/member.controller';
import { authenticate } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  createMemberSchema,
  bulkCreateMembersSchema,
  updateMemberSchema,
} from '../types/member.schema';

const router = Router();

// All routes require authentication and society access
router.use(authenticate);
router.use(verifySocietyAccess);

router.post('/:id/members', validate(createMemberSchema), createMember);
router.post('/:id/members/bulk', validate(bulkCreateMembersSchema), bulkCreateMembers);
router.get('/:id/members', getMembers);
router.patch('/:id/members/:memberId', validate(updateMemberSchema), updateMember);
router.delete('/:id/members/:memberId', deleteMember);

export default router;
