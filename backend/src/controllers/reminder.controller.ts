import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import { AppError } from '../middleware/error-handler';
import { logAudit } from '../utils/audit';
import { scheduleReminderJobs, scheduleRemindersForInvoice } from '../services/reminder.service';
import { sendEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';

const prisma = getPrismaClient();

// ============================================
// REMINDER RULE MANAGEMENT
// ============================================

/**
 * Create a new reminder rule
 */
export const createReminderRule = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { name, type, daysOffset, channel, emailSubject, emailBody, smsBody, whatsappBody, isActive } = req.body;
    const userId = req.user?.userId;

    const rule = await prisma.reminderRule.create({
      data: {
        societyId,
        name,
        type,
        daysOffset,
        channel,
        emailSubject: emailSubject || null,
        emailBody: emailBody || null,
        smsBody: smsBody || null,
        whatsappBody: whatsappBody || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await logAudit({
      userId: userId!,
      societyId,
      action: 'reminder_rule_create',
      entityType: 'reminder_rule',
      entityId: rule.id,
      payload: { name, type, channel },
    });

    sendSuccessResponse(res, rule, 'Reminder rule created successfully', 201);
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get all reminder rules for a society
 */
export const getReminderRules = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { includeInactive } = req.query;

    const where: any = { societyId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const rules = await prisma.reminderRule.findMany({
      where,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });

    sendSuccessResponse(res, rules, 'Reminder rules retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Update reminder rule
 */
export const updateReminderRule = async (req: Request, res: Response) => {
  try {
    const { id: societyId, ruleId } = req.params;
    const updates = req.body;
    const userId = req.user?.userId;

    const rule = await prisma.reminderRule.findFirst({
      where: { id: ruleId, societyId },
    });

    if (!rule) {
      throw new AppError('Reminder rule not found', 404);
    }

    const updated = await prisma.reminderRule.update({
      where: { id: ruleId },
      data: updates,
    });

    await logAudit({
      userId: userId!,
      societyId,
      action: 'reminder_rule_update',
      entityType: 'reminder_rule',
      entityId: ruleId,
      payload: { changes: updates },
    });

    sendSuccessResponse(res, updated, 'Reminder rule updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Delete reminder rule
 */
export const deleteReminderRule = async (req: Request, res: Response) => {
  try {
    const { id: societyId, ruleId } = req.params;
    const userId = req.user?.userId;

    const rule = await prisma.reminderRule.findFirst({
      where: { id: ruleId, societyId },
    });

    if (!rule) {
      throw new AppError('Reminder rule not found', 404);
    }

    // Soft delete by marking as inactive
    await prisma.reminderRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });

    await logAudit({
      userId: userId!,
      societyId,
      action: 'reminder_rule_delete',
      entityType: 'reminder_rule',
      entityId: ruleId,
      payload: {},
    });

    sendSuccessResponse(res, null, 'Reminder rule deleted successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// REMINDER SCHEDULING
// ============================================

/**
 * Schedule reminders for a specific period
 */
export const scheduleReminders = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { periodMonth, periodYear } = req.body;
    const userId = req.user?.userId;

    // Get all active reminder rules for the society
    const rules = await prisma.reminderRule.findMany({
      where: { societyId, isActive: true },
    });

    if (rules.length === 0) {
      throw new AppError('No active reminder rules found for this society', 400);
    }

    // Get all invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId,
        periodMonth,
        periodYear,
        status: { in: ['GENERATED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      include: {
        member: true,
      },
    });

    if (invoices.length === 0) {
      throw new AppError('No invoices found for the specified period', 404);
    }

    const jobCount = await scheduleReminderJobs(societyId, rules, invoices);

    await logAudit({
      userId: userId!,
      societyId,
      action: 'reminders_schedule',
      entityType: 'reminder',
      entityId: societyId,
      payload: { periodMonth, periodYear, jobCount },
    });

    sendSuccessResponse(
      res,
      { jobCount, invoiceCount: invoices.length, ruleCount: rules.length },
      `Successfully scheduled ${jobCount} reminder jobs`
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Test reminder with sample data
 */
export const testReminder = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { ruleId, testEmail, testPhone } = req.body;
    const userId = req.user?.userId;

    const rule = await prisma.reminderRule.findFirst({
      where: { id: ruleId, societyId },
    });

    if (!rule) {
      throw new AppError('Reminder rule not found', 404);
    }

    // Create sample data for template testing
    const sampleData = {
      name: 'Test User',
      unit: 'A-101',
      amount: '5000.00',
      dueDate: new Date().toLocaleDateString('en-IN'),
      invoiceNo: 'INV-2024-00001',
    };

    let result;

    if (rule.channel === 'EMAIL') {
      if (!testEmail) {
        throw new AppError('Test email address is required', 400);
      }
      if (!rule.emailSubject || !rule.emailBody) {
        throw new AppError('Email template not configured', 400);
      }

      const subject = replaceTemplateVariables(rule.emailSubject, sampleData);
      const body = replaceTemplateVariables(rule.emailBody, sampleData);

      result = await sendEmail({
        to: testEmail,
        subject,
        body,
      });
    } else if (rule.channel === 'SMS') {
      if (!testPhone) {
        throw new AppError('Test phone number is required', 400);
      }
      if (!rule.smsBody) {
        throw new AppError('SMS template not configured', 400);
      }

      const message = replaceTemplateVariables(rule.smsBody, sampleData);

      result = await sendSMS({
        to: testPhone,
        message,
      });
    } else {
      throw new AppError('WhatsApp reminders not yet implemented', 501);
    }

    await logAudit({
      userId: userId!,
      societyId,
      action: 'reminder_test',
      entityType: 'reminder_rule',
      entityId: ruleId,
      payload: { channel: rule.channel, recipient: testEmail || testPhone },
    });

    sendSuccessResponse(res, { messageId: result }, 'Test reminder sent successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get reminder job history
 */
export const getReminderJobs = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { status, invoiceId, fromDate, toDate, page = 1, limit = 50 } = req.query as any;

    const where: any = {};

    // Filter by society through reminder rule
    const rules = await prisma.reminderRule.findMany({
      where: { societyId },
      select: { id: true },
    });

    where.reminderRuleId = { in: rules.map((r) => r.id) };

    if (status) {
      where.status = status;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (fromDate || toDate) {
      where.scheduledAt = {};
      if (fromDate) {
        where.scheduledAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.scheduledAt.lte = new Date(toDate);
      }
    }

    const [jobs, total] = await Promise.all([
      prisma.reminderJob.findMany({
        where,
        include: {
          reminderRule: true,
          invoice: {
            include: {
              member: true,
            },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reminderJob.count({ where }),
    ]);

    sendSuccessResponse(
      res,
      {
        jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Reminder jobs retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get reminder statistics for a society
 */
export const getReminderStats = async (req: Request, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { fromDate, toDate } = req.query as any;

    // Get all rules for this society
    const rules = await prisma.reminderRule.findMany({
      where: { societyId },
      select: { id: true },
    });

    const ruleIds = rules.map((r) => r.id);

    const where: any = {
      reminderRuleId: { in: ruleIds },
    };

    if (fromDate || toDate) {
      where.scheduledAt = {};
      if (fromDate) {
        where.scheduledAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.scheduledAt.lte = new Date(toDate);
      }
    }

    const [total, scheduled, sent, failed, skipped] = await Promise.all([
      prisma.reminderJob.count({ where }),
      prisma.reminderJob.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.reminderJob.count({ where: { ...where, status: 'SENT' } }),
      prisma.reminderJob.count({ where: { ...where, status: 'FAILED' } }),
      prisma.reminderJob.count({ where: { ...where, status: 'SKIPPED' } }),
    ]);

    const deliveryRate = total > 0 ? ((sent / total) * 100).toFixed(2) : '0';

    sendSuccessResponse(
      res,
      {
        total,
        scheduled,
        sent,
        failed,
        skipped,
        deliveryRate: `${deliveryRate}%`,
      },
      'Reminder statistics retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}
