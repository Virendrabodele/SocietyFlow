import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { verifySocietyAccess } from '../middleware/society-access';
import { validate } from '../middleware/validation';
import {
  createReminderRuleSchema,
  getReminderRulesSchema,
  testReminderSchema,
  scheduleRemindersSchema,
} from '../types/payment.schema';
import {
  createReminderRule,
  getReminderRules,
  updateReminderRule,
  deleteReminderRule,
  scheduleReminders,
  testReminder,
  getReminderJobs,
  getReminderStats,
} from '../controllers/reminder.controller';

const router = Router();

// ============================================
// REMINDER RULE ROUTES
// ============================================

// Create reminder rule
router.post(
  '/:id/reminders',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  validate(createReminderRuleSchema),
  createReminderRule
);

// Get all reminder rules
router.get(
  '/:id/reminders',
  authenticate,
  verifySocietyAccess,
  validate(getReminderRulesSchema),
  getReminderRules
);

// Update reminder rule
router.patch(
  '/:id/reminders/:ruleId',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  updateReminderRule
);

// Delete reminder rule
router.delete(
  '/:id/reminders/:ruleId',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  deleteReminderRule
);

// ============================================
// REMINDER SCHEDULING ROUTES
// ============================================

// Schedule reminders for a period
router.post(
  '/:id/reminders/schedule',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER', 'COMMITTEE_USER'),
  verifySocietyAccess,
  validate(scheduleRemindersSchema),
  scheduleReminders
);

// Test reminder
router.post(
  '/:id/reminders/test',
  authenticate,
  authorize('MASTER_ADMIN', 'SOCIETY_ADMIN', 'TREASURER'),
  verifySocietyAccess,
  validate(testReminderSchema),
  testReminder
);

// ============================================
// REMINDER JOB HISTORY ROUTES
// ============================================

// Get reminder job history
router.get(
  '/:id/reminders/jobs',
  authenticate,
  verifySocietyAccess,
  getReminderJobs
);

// Get reminder statistics
router.get(
  '/:id/reminders/stats',
  authenticate,
  verifySocietyAccess,
  getReminderStats
);

export default router;
