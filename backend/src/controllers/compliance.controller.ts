import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import {
  getTaxConfig,
  updateTaxConfig,
} from '../services/tax.service';
import {
  getInvoiceSeriesConfig,
  updateInvoiceSeriesConfig,
} from '../services/invoice-series.service';
import {
  getReceiptSeriesConfig,
  updateReceiptSeriesConfig,
} from '../services/receipt-series.service';

// ============================================
// TAX CONFIGURATION
// ============================================

export const getTaxConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id as string;
    const taxConfig = await getTaxConfig(societyId);
import { validateGSTIN, validatePAN } from '../utils/validation';
import {
  generateReceiptNumber,
  configureReceiptSequence,
  getCurrentFinancialYear,
} from '../services/receipt-sequence.service';

/**
 * Get Tax Configuration for a society
 */
export const getTaxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const taxConfig = await prisma.taxConfig.findUnique({
      where: { societyId },
    });

    if (!taxConfig) {
      throw new AppError('Tax configuration not found', 404);
    }

    sendSuccessResponse(res, taxConfig, 'Tax configuration retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateTaxConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id as string;
/**
 * Create or Update Tax Configuration
 */
export const upsertTaxConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { gstEnabled, gstin, taxRegime, defaultTaxRate, taxThreshold, roundingPolicy } = req.body;

    const prisma = getPrismaClient();

    // Get old config for audit
    const oldConfig = await getTaxConfig(societyId);

    const taxConfig = await updateTaxConfig(societyId, {
      gstEnabled,
      gstin,
      taxRegime,
      defaultTaxRate,
      taxThreshold,
      roundingPolicy,
    const {
      gstEnabled,
      defaultGstRate,
      placeOfSupply,
      isInterState,
      itemTaxRates,
      exemptionThreshold,
    } = req.body;

    const prisma = getPrismaClient();

    // Check if society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    if (!society) {
      throw new AppError('Society not found', 404);
    }

    // Upsert tax configuration
    const taxConfig = await prisma.taxConfig.upsert({
      where: { societyId },
      create: {
        societyId,
        gstEnabled: gstEnabled ?? false,
        defaultGstRate: defaultGstRate ?? 18,
        placeOfSupply,
        isInterState: isInterState ?? false,
        itemTaxRates: itemTaxRates || {},
        exemptionThreshold: exemptionThreshold || 0,
      },
      update: {
        gstEnabled,
        defaultGstRate,
        placeOfSupply,
        isInterState,
        itemTaxRates,
        exemptionThreshold,
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'tax_config_update',
      entityType: 'tax_config',
      entityId: taxConfig.id,
      payload: { gstEnabled, gstin, taxRegime, defaultTaxRate },
    });

    sendSuccessResponse(res, taxConfig, 'Tax configuration updated successfully');
      payload: { gstEnabled, defaultGstRate, placeOfSupply },
    });

    sendSuccessResponse(res, taxConfig, 'Tax configuration saved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// INVOICE SERIES CONFIGURATION
// ============================================

export const getInvoiceSeriesConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id as string;
    const config = await getInvoiceSeriesConfig(societyId);

    sendSuccessResponse(res, config, 'Invoice series configuration retrieved successfully');
/**
 * Update Society Compliance Information
 */
export const updateSocietyCompliance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { registeredAddress, gstin, pan, contactEmail, contactPhone } = req.body;

    // Validate GSTIN if provided
    if (gstin && !validateGSTIN(gstin)) {
      throw new AppError('Invalid GSTIN format', 400);
    }

    // Validate PAN if provided
    if (pan && !validatePAN(pan)) {
      throw new AppError('Invalid PAN format', 400);
    }

    const prisma = getPrismaClient();

    const society = await prisma.society.update({
      where: { id: societyId },
      data: {
        registeredAddress,
        gstin,
        pan,
        contactEmail,
        contactPhone,
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'society_compliance_update',
      entityType: 'society',
      entityId: societyId,
      payload: { gstin, pan, contactEmail },
    });

    sendSuccessResponse(res, society, 'Society compliance information updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateInvoiceSeriesConfiguration = async (
/**
 * Configure Receipt Sequence
 */
export const configureReceiptSequenceHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const societyId = req.params.id as string;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { prefix, includeYear, includeSocCode, separator, resetOnNewYear } = req.body;

    const config = await updateInvoiceSeriesConfig(societyId, {
      prefix,
      includeYear,
      includeSocCode,
      separator,
      resetOnNewYear,
    const { format, customFormat, prefix, resetOnNewFY } = req.body;

    await configureReceiptSequence(societyId, {
      format,
      customFormat,
      prefix,
      resetOnNewFY,
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'invoice_series_config_update',
      entityType: 'invoice_series_config',
      entityId: config.id,
      payload: { prefix, includeYear, includeSocCode },
    });

    sendSuccessResponse(res, config, 'Invoice series configuration updated successfully');
      action: 'receipt_sequence_config',
      entityType: 'receipt_sequence',
      payload: { format, prefix },
    });

    sendSuccessResponse(res, { success: true }, 'Receipt sequence configured successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RECEIPT SERIES CONFIGURATION
// ============================================

export const getReceiptSeriesConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id as string;
    const config = await getReceiptSeriesConfig(societyId);

    sendSuccessResponse(res, config, 'Receipt series configuration retrieved successfully');
/**
 * Get Receipt Sequence Configuration
 */
export const getReceiptSequenceConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const currentFY = getCurrentFinancialYear();

    const sequence = await prisma.receiptSequence.findUnique({
      where: {
        societyId_financialYear: {
          societyId,
          financialYear: currentFY,
        },
      },
    });

    if (!sequence) {
      throw new AppError('Receipt sequence not configured', 404);
    }

    sendSuccessResponse(res, sequence, 'Receipt sequence configuration retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateReceiptSeriesConfiguration = async (
/**
 * Generate Next Receipt Number (for preview)
 */
export const generateReceiptNumberHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const societyId = req.params.id as string;
    const societyId = req.params.id;

    const result = await generateReceiptNumber({ societyId });

    sendSuccessResponse(res, result, 'Receipt number generated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Create or Get Month Closure
 */
export const upsertMonthClosure = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { prefix, includeYear, includeSocCode, separator, resetOnNewYear } = req.body;

    const config = await updateReceiptSeriesConfig(societyId, {
      prefix,
      includeYear,
      includeSocCode,
      separator,
      resetOnNewYear,
    });

    const { periodMonth, periodYear, status } = req.body;

    const prisma = getPrismaClient();

    // Check if closure exists
    const existing = await prisma.monthClosure.findUnique({
      where: {
        societyId_periodMonth_periodYear: {
          societyId,
          periodMonth,
          periodYear,
        },
      },
    });

    let monthClosure;

    if (existing) {
      // Update existing
      monthClosure = await prisma.monthClosure.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      // Create new closure
      monthClosure = await prisma.monthClosure.create({
        data: {
          societyId,
          periodMonth,
          periodYear,
          status: status || 'DRAFT',
        },
      });
    }

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'receipt_series_config_update',
      entityType: 'receipt_series_config',
      entityId: config.id,
      payload: { prefix, includeYear, includeSocCode },
    });

    sendSuccessResponse(res, config, 'Receipt series configuration updated successfully');
      action: 'month_closure_create',
      entityType: 'month_closure',
      entityId: monthClosure.id,
      payload: { periodMonth, periodYear, status },
    });

    sendSuccessResponse(res, monthClosure, 'Month closure created/updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Update Month Closure Status (Lock/Unlock)
 */
export const updateMonthClosureStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: societyId, closureId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const { status, unlockReason } = req.body;

    const prisma = getPrismaClient();

    const closure = await prisma.monthClosure.findUnique({
      where: { id: closureId },
    });

    if (!closure || closure.societyId !== societyId) {
      throw new AppError('Month closure not found', 404);
    }

    // Validate status transitions
    if (status === 'LOCKED' && closure.status === 'LOCKED') {
      throw new AppError('Month is already locked', 400);
    }

    // Build update data
    const updateData: any = { status };

    if (status === 'LOCKED') {
      updateData.lockedAt = new Date();
      updateData.lockedBy = userId;
    }

    if (status === 'REVIEWED') {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = userId;
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = userId;
    }

    if (unlockReason && closure.status === 'LOCKED') {
      updateData.unlockReason = unlockReason;
    }

    const updatedClosure = await prisma.monthClosure.update({
      where: { id: closureId },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: `month_closure_${status.toLowerCase()}`,
      entityType: 'month_closure',
      entityId: closureId,
      payload: { status, unlockReason },
    });

    sendSuccessResponse(res, updatedClosure, `Month closure ${status.toLowerCase()} successfully`);
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get Month Closures for a society
 */
export const getMonthClosures = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const closures = await prisma.monthClosure.findMany({
      where: { societyId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    sendSuccessResponse(res, closures, 'Month closures retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Get Audit Logs with Filters
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { action, entityType, startDate, endDate, userId: filterUserId } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (filterUserId) {
      where.userId = filterUserId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const auditLogs = await prisma.auditLog.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 entries
    });

    sendSuccessResponse(res, auditLogs, 'Audit logs retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
