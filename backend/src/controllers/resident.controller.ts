import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response';
import { AppError } from '../middleware/error-handler';

const prisma = getPrismaClient();

// ============================================
// RESIDENT DASHBOARD
// ============================================

/**
 * Get resident dashboard with financial summary
 */
export const getResidentDashboard = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { societyId } = req.query;

    // Find member associated with this user
    // For now, we use email matching. In production, add a userId field to Member model
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find member by email
    const memberWhere: any = { email: user.email };
    if (societyId) {
      memberWhere.societyId = societyId;
    }

    const members = await prisma.member.findMany({
      where: memberWhere,
      include: {
        society: true,
      },
    });

    if (members.length === 0) {
      throw new AppError('No member profile found for this user', 404);
    }

    // Get dashboard data for all member profiles
    const dashboards = await Promise.all(
      members.map(async (member) => {
        // Get unpaid invoices
        const unpaidInvoices = await prisma.invoice.findMany({
          where: {
            memberId: member.id,
            status: { in: ['GENERATED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
        });

        // Calculate outstanding amount
        const outstanding = unpaidInvoices.reduce((sum, inv) => {
          // Get total paid for this invoice
          const paid = 0; // Will be calculated from payments
          return sum + (inv.totalAmount - paid);
        }, 0);

        // Get upcoming due date
        const upcomingDue = unpaidInvoices.length > 0 ? unpaidInvoices[0].dueDate : null;

        // Get last payment submission status
        const lastPayment = await prisma.paymentSubmission.findFirst({
          where: {
            invoice: {
              memberId: member.id,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          society: {
            id: member.society.id,
            name: member.society.name,
            code: member.society.code,
          },
          member: {
            id: member.id,
            name: member.name,
            unitNo: member.unitNo,
          },
          financialSummary: {
            currentOutstanding: outstanding,
            upcomingDueDate: upcomingDue,
            unpaidInvoiceCount: unpaidInvoices.length,
            lastPaymentStatus: lastPayment?.status || null,
            lastPaymentDate: lastPayment?.paidDate || null,
          },
        };
      })
    );

    sendSuccessResponse(res, dashboards, 'Dashboard data retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RESIDENT INVOICES
// ============================================

/**
 * Get invoices for the resident
 */
export const getResidentInvoices = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { societyId, status, fromMonth, fromYear, toMonth, toYear, page = 1, limit = 50 } = req.query as any;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find member(s) by email
    const memberWhere: any = { email: user.email };
    if (societyId) {
      memberWhere.societyId = societyId;
    }

    const members = await prisma.member.findMany({
      where: memberWhere,
    });

    if (members.length === 0) {
      throw new AppError('No member profile found', 404);
    }

    const memberIds = members.map((m) => m.id);

    // Build invoice query
    const where: any = {
      memberId: { in: memberIds },
    };

    if (status) {
      where.status = status;
    }

    if (fromMonth && fromYear) {
      where.OR = [
        {
          periodYear: { gt: fromYear },
        },
        {
          periodYear: fromYear,
          periodMonth: { gte: fromMonth },
        },
      ];
    }

    if (toMonth && toYear) {
      where.AND = [
        {
          OR: [
            {
              periodYear: { lt: toYear },
            },
            {
              periodYear: toYear,
              periodMonth: { lte: toMonth },
            },
          ],
        },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          lineItems: true,
          payments: true,
          paymentSubmissions: {
            where: {
              status: { in: ['SUBMITTED', 'VERIFIED'] },
            },
          },
          society: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              unitNo: true,
            },
          },
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    // Add calculated fields
    const enhancedInvoices = invoices.map((invoice) => {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalSubmitted = invoice.paymentSubmissions.reduce((sum, ps) => sum + ps.amount, 0);
      const remaining = invoice.totalAmount - totalPaid - totalSubmitted;

      return {
        ...invoice,
        totalPaid,
        totalSubmitted,
        remainingAmount: remaining,
      };
    });

    sendSuccessResponse(
      res,
      {
        invoices: enhancedInvoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Invoices retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RESIDENT RECEIPTS
// ============================================

/**
 * Get receipts for the resident
 */
export const getResidentReceipts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { societyId, fromDate, toDate, page = 1, limit = 50 } = req.query as any;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find member(s)
    const memberWhere: any = { email: user.email };
    if (societyId) {
      memberWhere.societyId = societyId;
    }

    const members = await prisma.member.findMany({
      where: memberWhere,
    });

    if (members.length === 0) {
      throw new AppError('No member profile found', 404);
    }

    const memberIds = members.map((m) => m.id);

    // Build receipt query
    const where: any = {
      invoice: {
        memberId: { in: memberIds },
      },
    };

    if (fromDate || toDate) {
      where.issuedOn = {};
      if (fromDate) {
        where.issuedOn.gte = new Date(fromDate);
      }
      if (toDate) {
        where.issuedOn.lte = new Date(toDate);
      }
    }

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: {
          invoice: {
            include: {
              member: {
                select: {
                  name: true,
                  unitNo: true,
                },
              },
              society: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { issuedOn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.receipt.count({ where }),
    ]);

    sendSuccessResponse(
      res,
      {
        receipts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Receipts retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RESIDENT PAYMENTS
// ============================================

/**
 * Get payment submission history for the resident
 */
export const getResidentPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { societyId, status, page = 1, limit = 50 } = req.query as any;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find member(s)
    const memberWhere: any = { email: user.email };
    if (societyId) {
      memberWhere.societyId = societyId;
    }

    const members = await prisma.member.findMany({
      where: memberWhere,
    });

    if (members.length === 0) {
      throw new AppError('No member profile found', 404);
    }

    const memberIds = members.map((m) => m.id);

    // Build payment submission query
    const where: any = {
      invoice: {
        memberId: { in: memberIds },
      },
    };

    if (status) {
      where.status = status;
    }

    const [submissions, total] = await Promise.all([
      prisma.paymentSubmission.findMany({
        where,
        include: {
          invoice: {
            include: {
              member: {
                select: {
                  name: true,
                  unitNo: true,
                },
              },
              society: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
          bankAccount: {
            select: {
              bankName: true,
              accountHolderName: true,
            },
          },
          paymentProofs: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentSubmission.count({ where }),
    ]);

    sendSuccessResponse(
      res,
      {
        payments: submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Payment history retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RESIDENT PROFILE
// ============================================

/**
 * Get resident's member profiles across societies
 */
export const getResidentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Find all member profiles linked to this user's email
    const members = await prisma.member.findMany({
      where: { email: user.email },
      include: {
        society: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            state: true,
          },
        },
      },
    });

    sendSuccessResponse(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
        },
        memberProfiles: members,
      },
      'Profile retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
