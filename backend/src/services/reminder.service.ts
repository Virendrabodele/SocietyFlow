import { getPrismaClient } from '../config/database';
import { sendEmail } from './email.service';
import { sendSMS } from './sms.service';

const prisma = getPrismaClient();

interface ReminderRule {
  id: string;
  type: string;
  daysOffset: number;
  channel: string;
  emailSubject: string | null;
  emailBody: string | null;
  smsBody: string | null;
  whatsappBody: string | null;
}

interface Invoice {
  id: string;
  dueDate: Date | null;
  totalAmount: number;
  member: {
    id: string;
    name: string;
    unitNo: string;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Schedule reminder jobs for multiple invoices based on rules
 */
export async function scheduleReminderJobs(
  societyId: string,
  rules: ReminderRule[],
  invoices: Invoice[]
): Promise<number> {
  let jobCount = 0;

  for (const invoice of invoices) {
    if (!invoice.dueDate) {
      console.warn(`Invoice ${invoice.id} has no due date, skipping reminders`);
      continue;
    }

    for (const rule of rules) {
      // Calculate scheduled date based on due date and offset
      const scheduledAt = new Date(invoice.dueDate);
      scheduledAt.setDate(scheduledAt.getDate() + rule.daysOffset);

      // Skip if scheduled date is in the past
      if (scheduledAt < new Date()) {
        console.log(`Skipping past reminder for invoice ${invoice.id}, rule ${rule.id}`);
        continue;
      }

      // Check if member has contact info for the channel
      if (rule.channel === 'EMAIL' && !invoice.member.email) {
        console.warn(`Member ${invoice.member.id} has no email, skipping email reminder`);
        continue;
      }

      if (rule.channel === 'SMS' && !invoice.member.phone) {
        console.warn(`Member ${invoice.member.id} has no phone, skipping SMS reminder`);
        continue;
      }

      // Check if job already exists
      const existing = await prisma.reminderJob.findFirst({
        where: {
          reminderRuleId: rule.id,
          invoiceId: invoice.id,
        },
      });

      if (existing) {
        console.log(`Reminder job already exists for invoice ${invoice.id}, rule ${rule.id}`);
        continue;
      }

      // Create reminder job
      await prisma.reminderJob.create({
        data: {
          reminderRuleId: rule.id,
          invoiceId: invoice.id,
          memberId: invoice.member.id,
          scheduledAt,
          status: 'SCHEDULED',
        },
      });

      jobCount++;
    }
  }

  return jobCount;
}

/**
 * Schedule reminders for a single invoice (called when invoice is created/updated)
 */
export async function scheduleRemindersForInvoice(
  societyId: string,
  invoice: Invoice
): Promise<void> {
  const rules = await prisma.reminderRule.findMany({
    where: {
      societyId,
      isActive: true,
    },
  });

  await scheduleReminderJobs(societyId, rules, [invoice]);
}

/**
 * Process scheduled reminder jobs (to be called by worker/cron)
 */
export async function processScheduledReminders(): Promise<void> {
  const now = new Date();

  // Find all scheduled jobs that are due
  const dueJobs = await prisma.reminderJob.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: {
        lte: now,
      },
    },
    include: {
      reminderRule: true,
      invoice: {
        include: {
          member: true,
        },
      },
    },
    take: 100, // Process in batches
  });

  console.log(`Processing ${dueJobs.length} due reminder jobs`);

  for (const job of dueJobs) {
    try {
      // Mark as processing
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' },
      });

      // Check if invoice is still unpaid
      if (job.invoice.status === 'PAID' || job.invoice.status === 'CANCELLED') {
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: { status: 'SKIPPED', error: 'Invoice already paid or cancelled' },
        });
        continue;
      }

      // Prepare template data
      const templateData = {
        name: job.invoice.member.name,
        unit: job.invoice.member.unitNo,
        amount: job.invoice.totalAmount.toFixed(2),
        dueDate: job.invoice.dueDate
          ? new Date(job.invoice.dueDate).toLocaleDateString('en-IN')
          : 'N/A',
        invoiceNo: `INV-${job.invoice.periodYear}-${String(job.invoice.periodMonth).padStart(2, '0')}`,
      };

      let providerRef: string | undefined;

      // Send reminder based on channel
      if (job.reminderRule.channel === 'EMAIL') {
        if (!job.invoice.member.email) {
          throw new Error('Member has no email address');
        }

        const subject = replaceTemplateVariables(
          job.reminderRule.emailSubject || 'Payment Reminder',
          templateData
        );
        const body = replaceTemplateVariables(
          job.reminderRule.emailBody || 'Please pay your dues',
          templateData
        );

        providerRef = await sendEmail({
          to: job.invoice.member.email,
          subject,
          body,
        });
      } else if (job.reminderRule.channel === 'SMS') {
        if (!job.invoice.member.phone) {
          throw new Error('Member has no phone number');
        }

        const message = replaceTemplateVariables(
          job.reminderRule.smsBody || 'Payment reminder',
          templateData
        );

        providerRef = await sendSMS({
          to: job.invoice.member.phone,
          message,
        });
      } else {
        throw new Error(`Unsupported channel: ${job.reminderRule.channel}`);
      }

      // Mark as sent
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerRef,
        },
      });

      console.log(`Successfully sent reminder ${job.id} to ${job.invoice.member.name}`);
    } catch (error) {
      console.error(`Failed to send reminder ${job.id}:`, error);

      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

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

/**
 * Retry failed reminder jobs
 */
export async function retryFailedReminders(societyId: string): Promise<number> {
  const rules = await prisma.reminderRule.findMany({
    where: { societyId },
    select: { id: true },
  });

  const failedJobs = await prisma.reminderJob.findMany({
    where: {
      reminderRuleId: { in: rules.map((r) => r.id) },
      status: 'FAILED',
      sentAt: null,
    },
  });

  for (const job of failedJobs) {
    await prisma.reminderJob.update({
      where: { id: job.id },
      data: {
        status: 'SCHEDULED',
        error: null,
      },
    });
  }

  return failedJobs.length;
}
