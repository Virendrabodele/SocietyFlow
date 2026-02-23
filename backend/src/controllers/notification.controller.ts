import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';

export const sendInvoiceNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channels } = req.body;
    const { id: societyId, invoiceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    if (!Array.isArray(channels) || channels.length === 0) {
      throw new AppError('At least one notification channel is required', 400);
    }

    const prisma = getPrismaClient();

    // Get invoice with member details
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
      },
      include: {
        member: true,
        society: true,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const results = [];

    // Send email notification
    if (channels.includes('EMAIL')) {
      if (!invoice.member.email) {
        results.push({
          channel: 'EMAIL',
          status: 'FAILED',
          error: 'Member does not have an email address',
        });
      } else {
        try {
          const emailContent = `
Dear ${invoice.member.name},

Your maintenance bill for ${invoice.periodMonth}/${invoice.periodYear} is ready.

Unit No: ${invoice.member.unitNo}
Society: ${invoice.society.name}
Amount Due: ₹${invoice.totalAmount.toFixed(2)}

Please login to SocietyFlow to view the full invoice details.

Thank you,
${invoice.society.name} Management
          `.trim();

          const providerRef = await sendEmail({
            to: invoice.member.email,
            subject: `Maintenance Bill - ${invoice.periodMonth}/${invoice.periodYear}`,
            text: emailContent,
          });

          // Create notification record
          const notification = await prisma.notification.create({
            data: {
              societyId,
              invoiceId,
              memberId: invoice.memberId,
              channel: 'EMAIL',
              status: 'SENT',
              providerRef,
              sentAt: new Date(),
            },
          });

          results.push({
            channel: 'EMAIL',
            status: 'SENT',
            notificationId: notification.id,
          });
        } catch (error) {
          // Create failed notification record
          await prisma.notification.create({
            data: {
              societyId,
              invoiceId,
              memberId: invoice.memberId,
              channel: 'EMAIL',
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          results.push({
            channel: 'EMAIL',
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Failed to send email',
          });
        }
      }
    }

    // Send SMS notification
    if (channels.includes('SMS')) {
      if (!invoice.member.phone) {
        results.push({
          channel: 'SMS',
          status: 'FAILED',
          error: 'Member does not have a phone number',
        });
      } else {
        try {
          const smsContent = `${invoice.society.name}: Your maintenance bill for ${invoice.periodMonth}/${invoice.periodYear} is ₹${invoice.totalAmount.toFixed(2)}. Login to SocietyFlow to view details.`;

          const providerRef = await sendSMS({
            to: invoice.member.phone,
            message: smsContent,
          });

          // Create notification record
          const notification = await prisma.notification.create({
            data: {
              societyId,
              invoiceId,
              memberId: invoice.memberId,
              channel: 'SMS',
              status: 'SENT',
              providerRef,
              sentAt: new Date(),
            },
          });

          results.push({
            channel: 'SMS',
            status: 'SENT',
            notificationId: notification.id,
          });
        } catch (error) {
          // Create failed notification record
          await prisma.notification.create({
            data: {
              societyId,
              invoiceId,
              memberId: invoice.memberId,
              channel: 'SMS',
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          results.push({
            channel: 'SMS',
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Failed to send SMS',
          });
        }
      }
    }

    // Update invoice status to SENT if at least one notification succeeded
    const hasSuccess = results.some((r) => r.status === 'SENT');
    if (hasSuccess && invoice.status === 'GENERATED') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'SENT' },
      });
    }

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'notification_send',
      entityType: 'notification',
      payload: { invoiceId, channels, results },
    });

    sendSuccessResponse(res, results, 'Notifications processed');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
