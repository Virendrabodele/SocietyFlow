import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';

export const createBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountName, accountNumber, ifscCode, bankName, branchName, upiId, qrCodeUrl } =
      req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if bank account already exists for this society
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { societyId },
    });

    if (existingAccount) {
      throw new AppError('Bank account already exists for this society', 400);
    }

    // Create bank account
    const bankAccount = await prisma.bankAccount.create({
      data: {
        societyId,
        accountName,
        accountNumber,
        ifscCode,
        bankName,
        branchName: branchName || null,
        upiId: upiId || null,
        qrCodeUrl: qrCodeUrl || null,
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'bank_account_create',
      entityType: 'bank_account',
      entityId: bankAccount.id,
      payload: { accountName, bankName },
    });

    sendSuccessResponse(res, bankAccount, 'Bank account created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { societyId },
    });

    if (!bankAccount) {
      throw new AppError('Bank account not found', 404);
    }

    // Mask account number for security (show only last 4 digits)
    const maskedAccount = {
      ...bankAccount,
      accountNumber: `****${bankAccount.accountNumber.slice(-4)}`,
    };

    sendSuccessResponse(res, maskedAccount, 'Bank account retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountName, accountNumber, ifscCode, bankName, branchName, upiId, qrCodeUrl, isActive } =
      req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if bank account exists
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { societyId },
    });

    if (!existingAccount) {
      throw new AppError('Bank account not found', 404);
    }

    // Update bank account
    const updatedAccount = await prisma.bankAccount.update({
      where: { societyId },
      data: {
        ...(accountName && { accountName }),
        ...(accountNumber && { accountNumber }),
        ...(ifscCode && { ifscCode }),
        ...(bankName && { bankName }),
        ...(branchName !== undefined && { branchName }),
        ...(upiId !== undefined && { upiId }),
        ...(qrCodeUrl !== undefined && { qrCodeUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'bank_account_update',
      entityType: 'bank_account',
      entityId: updatedAccount.id,
      payload: req.body,
    });

    sendSuccessResponse(res, updatedAccount, 'Bank account updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const deleteBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if bank account exists
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { societyId },
    });

    if (!existingAccount) {
      throw new AppError('Bank account not found', 404);
    }

    // Delete bank account
    await prisma.bankAccount.delete({
      where: { societyId },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'bank_account_delete',
      entityType: 'bank_account',
      entityId: existingAccount.id,
      payload: {},
    });

    sendSuccessResponse(res, null, 'Bank account deleted successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const uploadPaymentReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { referenceNo, transactionDate, amount, remarks, fileUrl } = req.body;
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

    // Create payment upload reference
    const paymentUpload = await prisma.paymentUploadReference.create({
      data: {
        invoiceId,
        uploadedByUserId: userId,
        referenceNo: referenceNo || null,
        transactionDate: new Date(transactionDate),
        amount,
        remarks: remarks || null,
        fileUrl: fileUrl || null,
        verificationStatus: 'PENDING',
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'payment_reference_upload',
      entityType: 'payment_upload',
      entityId: paymentUpload.id,
      payload: { invoiceId, amount, referenceNo },
    });

    sendSuccessResponse(res, paymentUpload, 'Payment reference uploaded successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const verifyPaymentReference = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { verificationStatus, verificationNotes } = req.body;
    const { id: societyId, uploadId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Find payment upload reference
    const paymentUpload = await prisma.paymentUploadReference.findFirst({
      where: {
        id: uploadId,
        invoice: {
          societyId,
        },
      },
      include: {
        invoice: true,
      },
    });

    if (!paymentUpload) {
      throw new AppError('Payment upload reference not found', 404);
    }

    if (paymentUpload.verificationStatus !== 'PENDING') {
      throw new AppError(
        `Payment upload already ${paymentUpload.verificationStatus.toLowerCase()}`,
        400
      );
    }

    // Update payment upload reference
    const updatedUpload = await prisma.paymentUploadReference.update({
      where: { id: uploadId },
      data: {
        verificationStatus,
        verifiedByUserId: userId,
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || null,
      },
    });

    // If approved, create payment and update invoice status
    if (verificationStatus === 'APPROVED') {
      const payment = await prisma.payment.create({
        data: {
          societyId,
          invoiceId: paymentUpload.invoiceId,
          amountPaid: paymentUpload.amount,
          paidOn: paymentUpload.transactionDate,
          mode: paymentUpload.referenceNo ? 'UPI' : 'BANK_TRANSFER',
          referenceNo: paymentUpload.referenceNo,
          notes: paymentUpload.remarks,
        },
      });

      // Calculate total paid
      const invoice = paymentUpload.invoice;
      const allPayments = await prisma.payment.findMany({
        where: { invoiceId: invoice.id },
      });
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);

      // Update invoice status
      const updatedStatus = totalPaid >= invoice.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: updatedStatus },
      });

      // Create audit log for payment
      await createAuditLog({
        userId,
        societyId,
        action: 'payment_create',
        entityType: 'payment',
        entityId: payment.id,
        payload: { invoiceId: invoice.id, amount: paymentUpload.amount, mode: 'BANK_TRANSFER' },
      });
    }

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'payment_reference_verify',
      entityType: 'payment_upload',
      entityId: uploadId,
      payload: { verificationStatus, verificationNotes },
    });

    sendSuccessResponse(res, updatedUpload, 'Payment reference verified successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getPaymentUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { invoiceId, verificationStatus } = req.query;

    const prisma = getPrismaClient();

    const where: any = {
      invoice: {
        societyId,
      },
    };

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (verificationStatus) {
      where.verificationStatus = verificationStatus;
    }

    const paymentUploads = await prisma.paymentUploadReference.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    sendSuccessResponse(res, paymentUploads, 'Payment uploads retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
