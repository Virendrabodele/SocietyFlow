import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import { calculateLineItemAmount, calculateInvoiceTotal, MemberVariables } from '../utils/formula-evaluator';

export const generateInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const periodMonth = parseInt(month as string, 10);
    const periodYear = parseInt(year as string, 10);

    const prisma = getPrismaClient();

    // Get all active members
    const members = await prisma.member.findMany({
      where: {
        societyId,
        status: 'ACTIVE',
      },
    });

    if (members.length === 0) {
      throw new AppError('No active members found', 400);
    }

    // Get all active billing line items
    const lineItems = await prisma.billingLineItem.findMany({
      where: {
        societyId,
        isActive: true,
      },
      include: {
        billingHead: true,
      },
    });

    if (lineItems.length === 0) {
      throw new AppError('No active billing line items found', 400);
    }

    // Check for existing invoices for this period
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        societyId,
        periodMonth,
        periodYear,
      },
    });

    if (existingInvoices.length > 0) {
      throw new AppError(
        `Invoices already exist for ${periodMonth}/${periodYear}. Found ${existingInvoices.length} existing invoices.`,
        400
      );
    }

    const invoicesCreated = [];

    // Generate invoice for each member
    for (const member of members) {
      const memberVariables = member.variables as MemberVariables;
      const invoiceLineItems = [];
      const taxableFlags = [];

      // Calculate each line item
      for (const lineItem of lineItems) {
        try {
          const calculation = calculateLineItemAmount(
            {
              basisType: lineItem.basisType as any,
              rate: lineItem.rate,
              customKey: lineItem.customKey || undefined,
              formulaText: lineItem.formulaText || undefined,
            },
            memberVariables
          );

          invoiceLineItems.push({
            lineItemName: lineItem.name,
            basisType: lineItem.basisType,
            units: calculation.units,
            rate: calculation.rate,
            amount: calculation.amount,
            meta: {
              billingHeadId: lineItem.billingHeadId,
              billingHeadName: lineItem.billingHead.name,
              frequency: lineItem.frequency,
            },
          });

          taxableFlags.push(lineItem.taxable);
        } catch (error) {
          console.error(`Error calculating line item ${lineItem.name} for member ${member.name}:`, error);
          // Skip this line item for this member
        }
      }

      // Calculate totals (assume 18% GST for now)
      const totals = calculateInvoiceTotal(
        invoiceLineItems.map((item) => ({
          units: item.units,
          rate: item.rate,
          amount: item.amount,
        })),
        taxableFlags,
        18 // TODO: Get tax rate from society settings
      );

      // Create invoice with line items
      const invoice = await prisma.invoice.create({
        data: {
          societyId,
          memberId: member.id,
          periodMonth,
          periodYear,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          status: 'GENERATED',
          lineItems: {
            create: invoiceLineItems,
          },
        },
        include: {
          lineItems: true,
          member: true,
        },
      });

      invoicesCreated.push(invoice);
    }

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'invoice_generate',
      entityType: 'invoice',
      payload: { periodMonth, periodYear, count: invoicesCreated.length },
    });

    sendSuccessResponse(
      res,
      {
        count: invoicesCreated.length,
        invoices: invoicesCreated,
      },
      `${invoicesCreated.length} invoices generated successfully`
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { month, year, status, memberId } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (month) {
      where.periodMonth = parseInt(month as string, 10);
    }

    if (year) {
      where.periodYear = parseInt(year as string, 10);
    }

    if (status) {
      where.status = status;
    }

    if (memberId) {
      where.memberId = memberId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            unitNo: true,
            email: true,
            phone: true,
          },
        },
        lineItems: true,
        payments: true,
        _count: {
          select: {
            payments: true,
            receipts: true,
          },
        },
      },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { member: { unitNo: 'asc' } },
      ],
    });

    sendSuccessResponse(res, invoices, 'Invoices retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getInvoiceDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: societyId, invoiceId } = req.params;
    const prisma = getPrismaClient();

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
      },
      include: {
        member: true,
        lineItems: true,
        payments: {
          orderBy: { paidOn: 'desc' },
        },
        receipts: {
          orderBy: { issuedOn: 'desc' },
        },
        paymentUploads: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            verifiedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        society: {
          include: {
            bankAccount: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    sendSuccessResponse(res, invoice, 'Invoice retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amountPaid, paidOn, mode, referenceNo, notes } = req.body;
    const { id: societyId, invoiceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Verify invoice exists
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
      },
      include: {
        payments: true,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Calculate total paid so far
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const newTotalPaid = totalPaid + amountPaid;

    // Validate payment amount
    if (newTotalPaid > invoice.totalAmount) {
      throw new AppError(
        `Payment amount exceeds invoice total. Remaining: ${invoice.totalAmount - totalPaid}`,
        400
      );
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        societyId,
        invoiceId,
        amountPaid,
        paidOn: new Date(paidOn),
        mode,
        referenceNo: referenceNo || null,
        notes: notes || null,
      },
    });

    // Update invoice status
    const updatedStatus = newTotalPaid >= invoice.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: updatedStatus },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'payment_create',
      entityType: 'payment',
      entityId: payment.id,
      payload: { invoiceId, amountPaid, mode },
    });

    sendSuccessResponse(res, payment, 'Payment recorded successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const createReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { receiptNo, issuedOn, fileUrl } = req.body;
    const { id: societyId, invoiceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Verify invoice exists
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Check if receipt number already exists
    const existingReceipt = await prisma.receipt.findUnique({
      where: {
        societyId_receiptNo: {
          societyId,
          receiptNo,
        },
      },
    });

    if (existingReceipt) {
      throw new AppError('Receipt with this number already exists', 400);
    }

    // Create receipt
    const receipt = await prisma.receipt.create({
      data: {
        societyId,
        invoiceId,
        receiptNo,
        issuedOn: new Date(issuedOn),
        fileUrl: fileUrl || null,
        createdByUserId: userId,
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'receipt_create',
      entityType: 'receipt',
      entityId: receipt.id,
      payload: { invoiceId, receiptNo },
    });

    sendSuccessResponse(res, receipt, 'Receipt created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getReceipts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { invoiceId, startDate, endDate } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (startDate || endDate) {
      where.issuedOn = {};
      if (startDate) {
        where.issuedOn.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.issuedOn.lte = new Date(endDate as string);
      }
    }

    const receipts = await prisma.receipt.findMany({
      where,
      include: {
        invoice: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                unitNo: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        issuedOn: 'desc',
      },
    });

    sendSuccessResponse(res, receipts, 'Receipts retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
