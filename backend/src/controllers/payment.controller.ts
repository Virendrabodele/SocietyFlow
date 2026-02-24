import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { encrypt, decrypt, maskAccountNumber, maskIfscCode } from '../utils/encryption';
import { createAuditLog } from '../utils/audit';

const prisma = getPrismaClient();

// ============================================
// BANK ACCOUNT MANAGEMENT
// ============================================

/**
 * Create a new bank account for a society
 */
export const createBankAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { bankName, accountHolderName, accountNumber, ifscCode, upiId, qrCodeUrl, isDefault } = req.body;
    const userId = req.user?.userId;

    // Encrypt account number before storing
    const encryptedAccountNumber = encrypt(accountNumber);

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.societyBankAccount.updateMany({
        where: { societyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const bankAccount = await prisma.societyBankAccount.create({
      data: {
        societyId,
        bankName,
        accountHolderName,
        accountNumber: encryptedAccountNumber,
        ifscCode,
        upiId: upiId || null,
        qrCodeUrl: qrCodeUrl || null,
        isDefault: isDefault || false,
      },
    });

    // Log audit
    await createAuditLog({
      userId: userId!,
      societyId,
      action: 'bank_account_create',
      entityType: 'bank_account',
      entityId: bankAccount.id,
      payload: { bankName, accountHolderName, isDefault },
    });

    // Return with masked account number
    const response = {
      ...bankAccount,
      accountNumber: maskAccountNumber(accountNumber),
      accountNumberLast4: accountNumber.slice(-4),
    };

    sendSuccessResponse(res, response, 'Bank account created successfully', 201);
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get all bank accounts for a society
 */
export const getBankAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { includeInactive } = req.query;

    const where: any = { societyId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const accounts = await prisma.societyBankAccount.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Mask sensitive data
    const maskedAccounts = accounts.map((account) => {
      const decryptedNumber = decrypt(account.accountNumber);
      return {
        ...account,
        accountNumber: maskAccountNumber(decryptedNumber),
        accountNumberLast4: decryptedNumber.slice(-4),
        ifscCode: maskIfscCode(account.ifscCode),
      };
    });

    sendSuccessResponse(res, maskedAccounts, 'Bank accounts retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get full bank account details (for payment instructions)
 */
export const getBankAccountDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId, accountId } = req.params;

    const account = await prisma.societyBankAccount.findFirst({
      where: {
        id: accountId,
        societyId,
        isActive: true,
      },
    });

    if (!account) {
      throw new AppError('Bank account not found', 404);
    }

    // Decrypt account number for display
    const decryptedNumber = decrypt(account.accountNumber);

    const response = {
      ...account,
      accountNumber: decryptedNumber, // Full number for payment
      accountNumberMasked: maskAccountNumber(decryptedNumber),
    };

    sendSuccessResponse(res, response, 'Bank account details retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Update bank account
 */
export const updateBankAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId, accountId } = req.params;
    const { bankName, accountHolderName, upiId, qrCodeUrl, isDefault, isActive } = req.body;
    const userId = req.user?.userId;

    const account = await prisma.societyBankAccount.findFirst({
      where: { id: accountId, societyId },
    });

    if (!account) {
      throw new AppError('Bank account not found', 404);
    }

    // If setting as default, unset other defaults
    if (isDefault && !account.isDefault) {
      await prisma.societyBankAccount.updateMany({
        where: { societyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.societyBankAccount.update({
      where: { id: accountId },
      data: {
        ...(bankName && { bankName }),
        ...(accountHolderName && { accountHolderName }),
        ...(upiId !== undefined && { upiId: upiId || null }),
        ...(qrCodeUrl !== undefined && { qrCodeUrl: qrCodeUrl || null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await createAuditLog({
      userId: userId!,
      societyId,
      action: 'bank_account_update',
      entityType: 'bank_account',
      entityId: accountId,
      payload: { changes: req.body },
    });

    const decryptedNumber = decrypt(updated.accountNumber);
    const response = {
      ...updated,
      accountNumber: maskAccountNumber(decryptedNumber),
      accountNumberLast4: decryptedNumber.slice(-4),
    };

    sendSuccessResponse(res, response, 'Bank account updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// PAYMENT SUBMISSION
// ============================================

/**
 * Submit payment proof for an invoice
 */
export const submitPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId, invoiceId } = req.params;
    const { amount, transactionRef, paidDate, bankAccountId, proofFiles } = req.body;
    const userId = req.user?.userId;

    // Verify invoice exists and belongs to society
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        payments: true,
        paymentSubmissions: {
          where: { status: { in: ['SUBMITTED', 'VERIFIED'] } },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Calculate already paid amount
    const paidAmount = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const submittedAmount = invoice.paymentSubmissions.reduce((sum, ps) => sum + ps.amount, 0);
    const remainingAmount = invoice.totalAmount - paidAmount - submittedAmount;

    if (amount > remainingAmount) {
      throw new AppError(`Payment amount exceeds remaining balance of ${remainingAmount}`, 400);
    }

    // Create payment submission
    const submission = await prisma.paymentSubmission.create({
      data: {
        societyId,
        invoiceId,
        amount,
        transactionRef: transactionRef || null,
        paidDate: new Date(paidDate),
        bankAccountId: bankAccountId || null,
        submittedByUserId: userId,
        status: 'SUBMITTED',
      },
    });

    // Create payment proof files if provided
    if (proofFiles && proofFiles.length > 0) {
      await prisma.paymentProof.createMany({
        data: proofFiles.map((file: any) => ({
          paymentSubmissionId: submission.id,
          fileUrl: file.fileUrl,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          uploadedBy: userId,
        })),
      });
    }

    await createAuditLog({
      userId: userId!,
      societyId,
      action: 'payment_submission_create',
      entityType: 'payment_submission',
      entityId: submission.id,
      payload: { invoiceId, amount, transactionRef },
    });

    // Fetch submission with proofs
    const submissionWithProofs = await prisma.paymentSubmission.findUnique({
      where: { id: submission.id },
      include: {
        paymentProofs: true,
        bankAccount: true,
        invoice: {
          include: {
            member: true,
          },
        },
      },
    });

    sendSuccessResponse(res, submissionWithProofs, 'Payment submitted successfully', 201);
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Verify or reject payment submission
 */
export const verifyPaymentSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId, submissionId } = req.params;
    const { action, verificationNotes, rejectionReason, createReceipt } = req.body;
    const userId = req.user?.userId;

    const submission = await prisma.paymentSubmission.findFirst({
      where: { id: submissionId, societyId },
      include: {
        invoice: {
          include: { member: true },
        },
      },
    });

    if (!submission) {
      throw new AppError('Payment submission not found', 404);
    }

    if (submission.status !== 'SUBMITTED') {
      throw new AppError('Payment submission has already been processed', 400);
    }

    if (action === 'verify') {
      // Update submission status
      const verified = await prisma.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'VERIFIED',
          verifiedByUserId: userId,
          verifiedAt: new Date(),
          verificationNotes: verificationNotes || null,
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          societyId,
          invoiceId: submission.invoiceId,
          amountPaid: submission.amount,
          paidOn: submission.paidDate,
          mode: 'BANK_TRANSFER',
          referenceNo: submission.transactionRef,
          notes: `Verified payment submission: ${submissionId}`,
        },
      });

      // Update invoice status
      const invoice = await prisma.invoice.findUnique({
        where: { id: submission.invoiceId },
        include: { payments: true },
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0) + submission.amount;

        let newStatus = invoice.status;
        if (totalPaid >= invoice.totalAmount) {
          newStatus = 'PAID';
        } else if (totalPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await prisma.invoice.update({
          where: { id: submission.invoiceId },
          data: { status: newStatus },
        });
      }

      // Create receipt if requested
      if (createReceipt && invoice) {
        const receiptCount = await prisma.receipt.count({ where: { societyId } });
        const receiptNo = `REC-${new Date().getFullYear()}-${String(receiptCount + 1).padStart(5, '0')}`;

        await prisma.receipt.create({
          data: {
            societyId,
            invoiceId: submission.invoiceId,
            receiptNo,
            amountReceived: submission.amount,
            issuedOn: new Date(),
            createdByUserId: userId!,
          },
        });
      }

      await createAuditLog({
        userId: userId!,
        societyId,
        action: 'payment_submission_verify',
        entityType: 'payment_submission',
        entityId: submissionId,
        payload: { amount: submission.amount, invoiceId: submission.invoiceId },
      });

      sendSuccessResponse(res, verified, 'Payment verified successfully');
    } else {
      // Reject submission
      const rejected = await prisma.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REJECTED',
          verifiedByUserId: userId,
          verifiedAt: new Date(),
          rejectionReason: rejectionReason || 'No reason provided',
        },
      });

      await createAuditLog({
        userId: userId!,
        societyId,
        action: 'payment_submission_reject',
        entityType: 'payment_submission',
        entityId: submissionId,
        payload: { reason: rejectionReason },
      });

      sendSuccessResponse(res, rejected, 'Payment submission rejected');
    }
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get payment submissions with filtering
 */
export const getPaymentSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId } = req.params;
    const { status, invoiceId, fromDate, toDate, page = 1, limit = 50 } = req.query as any;

    const where: any = { societyId };

    if (status) {
      where.status = status;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (fromDate || toDate) {
      where.paidDate = {};
      if (fromDate) {
        where.paidDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.paidDate.lte = new Date(toDate);
      }
    }

    const [submissions, total] = await Promise.all([
      prisma.paymentSubmission.findMany({
        where,
        include: {
          invoice: {
            include: { member: true },
          },
          bankAccount: true,
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
        submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Payment submissions retrieved successfully'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get payment submission by ID
 */
export const getPaymentSubmissionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id: societyId, submissionId } = req.params;

    const submission = await prisma.paymentSubmission.findFirst({
      where: { id: submissionId, societyId },
      include: {
        invoice: {
          include: {
            member: true,
            lineItems: true,
          },
        },
        bankAccount: true,
        paymentProofs: true,
      },
    });

    if (!submission) {
      throw new AppError('Payment submission not found', 404);
    }

    sendSuccessResponse(res, submission, 'Payment submission retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
