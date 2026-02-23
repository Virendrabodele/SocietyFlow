import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// ============================================
// MONTH-END REPORTS
// ============================================

export const getMonthEndReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { month, year } = req.query;

    if (!month || !year) {
      throw new AppError('Month and year are required', 400);
    }

    const periodMonth = parseInt(month as string, 10);
    const periodYear = parseInt(year as string, 10);

    const prisma = getPrismaClient();

    // Get all invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId,
        periodMonth,
        periodYear,
      },
      include: {
        member: true,
        lineItems: true,
        taxLines: true,
        receipts: {
          where: {
            status: { not: 'CANCELLED' },
          },
        },
        payments: true,
      },
    });

    // Calculate summary
    let totalBilled = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalTaxCollected = 0;

    const memberWiseOutstanding: any[] = [];
    const headWiseCollection: { [key: string]: number } = {};
    const collectionModeSummary: { [key: string]: number } = {};

    for (const invoice of invoices) {
      totalBilled += invoice.totalAmount;
      totalTaxCollected += invoice.taxAmount;

      // Calculate collected amount
      const collected = invoice.receipts.reduce((sum, receipt) => sum + receipt.amountReceived, 0);
      totalCollected += collected;

      const outstanding = invoice.totalAmount - collected;
      totalPending += outstanding;

      memberWiseOutstanding.push({
        memberId: invoice.member.id,
        memberName: invoice.member.name,
        unitNo: invoice.member.unitNo,
        invoiceNo: invoice.invoiceNo,
        totalAmount: invoice.totalAmount,
        collected,
        outstanding,
        status: invoice.status,
      });

      // Head-wise collection
      for (const lineItem of invoice.lineItems) {
        const headName = (lineItem.meta as any).billingHeadName || 'Other';
        headWiseCollection[headName] = (headWiseCollection[headName] || 0) + lineItem.amount;
      }

      // Collection mode summary
      for (const payment of invoice.payments) {
        collectionModeSummary[payment.mode] = (collectionModeSummary[payment.mode] || 0) + payment.amountPaid;
      }
    }

    // Tax summary
    const taxSummary = {
      totalTaxable: invoices.reduce((sum, inv) => sum + inv.taxableAmount, 0),
      totalCGST: invoices.reduce((sum, inv) => sum + inv.cgstAmount, 0),
      totalSGST: invoices.reduce((sum, inv) => sum + inv.sgstAmount, 0),
      totalIGST: invoices.reduce((sum, inv) => sum + inv.igstAmount, 0),
      totalTax: totalTaxCollected,
    };

    const report = {
      period: { month: periodMonth, year: periodYear },
      summary: {
        totalBilled,
        totalCollected,
        totalPending,
        totalTaxCollected,
        collectionRate: totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0,
      },
      memberWiseOutstanding,
      headWiseCollection,
      taxSummary,
      collectionModeSummary,
    };

    sendSuccessResponse(res, report, 'Month-end report generated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getTaxSummaryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { startMonth, startYear, endMonth, endYear } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (startMonth && startYear) {
      where.OR = where.OR || [];
      where.OR.push({
        AND: [
          { periodYear: { gte: parseInt(startYear as string) } },
          { periodMonth: { gte: parseInt(startMonth as string) } },
        ],
      });
    }

    if (endMonth && endYear) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { periodYear: { lt: parseInt(endYear as string) } },
          {
            AND: [
              { periodYear: parseInt(endYear as string) },
              { periodMonth: { lte: parseInt(endMonth as string) } },
            ],
          },
        ],
      });
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        taxLines: true,
      },
    });

    // Group by period
    const periodSummary: { [key: string]: any } = {};

    for (const invoice of invoices) {
      const key = `${invoice.periodYear}-${invoice.periodMonth.toString().padStart(2, '0')}`;

      if (!periodSummary[key]) {
        periodSummary[key] = {
          period: { month: invoice.periodMonth, year: invoice.periodYear },
          totalTaxable: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          totalTax: 0,
          invoiceCount: 0,
        };
      }

      periodSummary[key].totalTaxable += invoice.taxableAmount;
      periodSummary[key].totalCGST += invoice.cgstAmount;
      periodSummary[key].totalSGST += invoice.sgstAmount;
      periodSummary[key].totalIGST += invoice.igstAmount;
      periodSummary[key].totalTax += invoice.taxAmount;
      periodSummary[key].invoiceCount += 1;
    }

    sendSuccessResponse(res, Object.values(periodSummary), 'Tax summary report generated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getCollectionSummaryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { month, year } = req.query;

    if (!month || !year) {
      throw new AppError('Month and year are required', 400);
    }

    const periodMonth = parseInt(month as string, 10);
    const periodYear = parseInt(year as string, 10);

    const prisma = getPrismaClient();

    // Get all payments for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId,
        periodMonth,
        periodYear,
      },
      include: {
        payments: true,
        receipts: {
          where: {
            status: { not: 'CANCELLED' },
          },
        },
      },
    });

    const paymentsByMode: { [key: string]: { count: number; amount: number } } = {};
    const dailyCollection: { [key: string]: number } = {};

    let totalInvoices = invoices.length;
    let paidInvoices = 0;
    let partiallyPaidInvoices = 0;
    let unpaidInvoices = 0;

    for (const invoice of invoices) {
      if (invoice.status === 'PAID') paidInvoices++;
      else if (invoice.status === 'PARTIALLY_PAID') partiallyPaidInvoices++;
      else unpaidInvoices++;

      for (const payment of invoice.payments) {
        const mode = payment.mode;
        if (!paymentsByMode[mode]) {
          paymentsByMode[mode] = { count: 0, amount: 0 };
        }
        paymentsByMode[mode].count += 1;
        paymentsByMode[mode].amount += payment.amountPaid;

        // Daily collection
        const dateKey = payment.paidOn.toISOString().split('T')[0];
        dailyCollection[dateKey] = (dailyCollection[dateKey] || 0) + payment.amountPaid;
      }
    }

    const report = {
      period: { month: periodMonth, year: periodYear },
      invoiceSummary: {
        total: totalInvoices,
        paid: paidInvoices,
        partiallyPaid: partiallyPaidInvoices,
        unpaid: unpaidInvoices,
      },
      paymentsByMode,
      dailyCollection,
    };

    sendSuccessResponse(res, report, 'Collection summary generated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// AUDIT REPORTS
// ============================================

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { startDate, endDate, action, entityType, userId, page = '1', limit = '50' } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (userId) {
      where.userId = userId;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendSuccessResponse(
      res,
      {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
      'Audit logs retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getFinancialEventsReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { startDate, endDate } = req.query;

    const prisma = getPrismaClient();

    const where: any = {
      societyId,
      action: {
        in: [
          'invoice_generate',
          'invoice_update',
          'invoice_cancel',
          'payment_create',
          'payment_update',
          'receipt_create',
          'receipt_cancel',
          'tax_config_update',
        ],
      },
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const events = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    sendSuccessResponse(res, events, 'Financial events report generated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
