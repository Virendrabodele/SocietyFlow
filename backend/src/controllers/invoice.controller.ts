import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import { calculateLineItemAmount, MemberVariables } from '../utils/formula-evaluator';
import { getTaxConfig, calculateTax } from '../services/tax.service';
import { generateInvoiceNumber } from '../services/invoice-series.service';
import { generateReceiptNumber } from '../services/receipt-series.service';

export const generateInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, dueDate, termsAndConditions, paymentInstructions } = req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const periodMonth = parseInt(month as string, 10);
    const periodYear = parseInt(year as string, 10);

    const prisma = getPrismaClient();

    // Get society details for invoice numbering
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    // Get tax configuration
    const taxConfig = await getTaxConfig(societyId);

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
            taxable: lineItem.taxable,
            taxRate: lineItem.taxRate,
            sacHsnCode: lineItem.sacHsnCode || undefined,
            meta: {
              billingHeadId: lineItem.billingHeadId,
              billingHeadName: lineItem.billingHead.name,
              frequency: lineItem.frequency,
            },
          });
        } catch (error) {
          console.error(`Error calculating line item ${lineItem.name} for member ${member.name}:`, error);
          // Skip this line item for this member
        }
      }

      // Calculate tax using the tax service
      const taxCalculation = calculateTax({
        lineItems: invoiceLineItems.map((item) => ({
          amount: item.amount,
          taxable: item.taxable,
          taxRate: item.taxRate,
        })),
        taxConfig: {
          gstEnabled: taxConfig.gstEnabled,
          taxRegime: taxConfig.taxRegime,
          defaultTaxRate: taxConfig.defaultTaxRate,
          roundingPolicy: taxConfig.roundingPolicy,
        },
      });

      // Generate invoice number
      const invoiceNo = await generateInvoiceNumber(societyId, society.code);
      const invoiceDate = new Date();
      const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000); // Default: 15 days

      // Create invoice with line items and tax lines
      const invoice = await prisma.invoice.create({
        data: {
          societyId,
          memberId: member.id,
          invoiceNo,
          invoiceDate,
          dueDate: calculatedDueDate,
          periodMonth,
          periodYear,
          subtotal: taxCalculation.subtotal,
          taxableAmount: taxCalculation.taxableAmount,
          cgstAmount: taxCalculation.cgstAmount,
          sgstAmount: taxCalculation.sgstAmount,
          igstAmount: taxCalculation.igstAmount,
          taxAmount: taxCalculation.taxAmount,
          roundingAmount: taxCalculation.roundingAmount,
          totalAmount: taxCalculation.totalAmount,
          status: 'GENERATED',
          isLocked: true, // Lock invoice immediately upon generation
          termsAndConditions: termsAndConditions || 'Payment due within 15 days of invoice date.',
          paymentInstructions: paymentInstructions || null,
          lineItems: {
            create: invoiceLineItems,
          },
          taxLines: {
            create: taxCalculation.taxBreakdown.map((breakdown) => ({
              taxRate: breakdown.taxRate,
              taxableValue: breakdown.taxableValue,
              cgst: breakdown.cgst,
              sgst: breakdown.sgst,
              igst: breakdown.igst,
              totalTax: breakdown.totalTax,
            })),
          },
        },
        include: {
          lineItems: true,
          taxLines: true,
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
    const { amountReceived, issuedOn, fileUrl, status } = req.body;
    const { id: societyId, invoiceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Get society details for receipt numbering
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    // Verify invoice exists and get payment history
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
      },
      include: {
        receipts: {
          where: {
            status: { not: 'CANCELLED' },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Validate amount
    if (!amountReceived || amountReceived <= 0) {
      throw new AppError('Amount received must be greater than zero', 400);
    }

    // Calculate total already received
    const totalReceived = invoice.receipts.reduce((sum, receipt) => sum + receipt.amountReceived, 0);
    const outstanding = invoice.totalAmount - totalReceived;

    // Validate receipt amount doesn't exceed outstanding
    if (amountReceived > outstanding) {
      throw new AppError(
        `Receipt amount (${amountReceived}) exceeds outstanding balance (${outstanding})`,
        400
      );
    }

    // Auto-generate receipt number
    const receiptNo = await generateReceiptNumber(societyId, society.code);

    // Create receipt
    const receipt = await prisma.receipt.create({
      data: {
        societyId,
        invoiceId,
        receiptNo,
        amountReceived,
        status: status || 'FINAL',
        issuedOn: issuedOn ? new Date(issuedOn) : new Date(),
        fileUrl: fileUrl || null,
        createdByUserId: userId,
      },
    });

    // Update invoice status based on total received
    const newTotalReceived = totalReceived + amountReceived;
    let invoiceStatus = invoice.status;

    if (newTotalReceived >= invoice.totalAmount) {
      invoiceStatus = 'PAID';
    } else if (newTotalReceived > 0) {
      invoiceStatus = 'PARTIALLY_PAID';
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: invoiceStatus },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'receipt_create',
      entityType: 'receipt',
      entityId: receipt.id,
      payload: {
        invoiceId,
        receiptNo,
        amountReceived,
        outstanding: outstanding - amountReceived,
      },
    });

    sendSuccessResponse(
      res,
      {
        ...receipt,
        outstandingBefore: outstanding,
        outstandingAfter: outstanding - amountReceived,
      },
      'Receipt created successfully'
    );
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

export const cancelReceipt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: societyId, receiptId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Get receipt
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        societyId,
      },
      include: {
        invoice: true,
      },
    });

    if (!receipt) {
      throw new AppError('Receipt not found', 404);
    }

    if (receipt.status === 'CANCELLED') {
      throw new AppError('Receipt is already cancelled', 400);
    }

    // Cancel receipt (soft delete)
    const cancelledReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        status: 'CANCELLED',
        cancelledOn: new Date(),
        cancellationReason: reason || 'Cancelled by admin',
      },
    });

    // Recalculate invoice status
    const allReceipts = await prisma.receipt.findMany({
      where: {
        invoiceId: receipt.invoiceId,
        status: { not: 'CANCELLED' },
      },
    });

    const totalReceived = allReceipts.reduce((sum, r) => sum + r.amountReceived, 0);
    let invoiceStatus = receipt.invoice.status;

    if (totalReceived === 0) {
      invoiceStatus = 'GENERATED';
    } else if (totalReceived >= receipt.invoice.totalAmount) {
      invoiceStatus = 'PAID';
    } else {
      invoiceStatus = 'PARTIALLY_PAID';
    }

    await prisma.invoice.update({
      where: { id: receipt.invoiceId },
      data: { status: invoiceStatus },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'receipt_cancel',
      entityType: 'receipt',
      entityId: receiptId,
      payload: {
        receiptNo: receipt.receiptNo,
        reason,
        amountReceived: receipt.amountReceived,
      },
    });

    sendSuccessResponse(res, cancelledReceipt, 'Receipt cancelled successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
