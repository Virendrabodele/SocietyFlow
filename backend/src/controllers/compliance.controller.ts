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
    const societyId = req.params.id;
    const taxConfig = await getTaxConfig(societyId);

    sendSuccessResponse(res, taxConfig, 'Tax configuration retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateTaxConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
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
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// INVOICE SERIES CONFIGURATION
// ============================================

export const getInvoiceSeriesConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const config = await getInvoiceSeriesConfig(societyId);

    sendSuccessResponse(res, config, 'Invoice series configuration retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateInvoiceSeriesConfiguration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
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
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

// ============================================
// RECEIPT SERIES CONFIGURATION
// ============================================

export const getReceiptSeriesConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const config = await getReceiptSeriesConfig(societyId);

    sendSuccessResponse(res, config, 'Receipt series configuration retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateReceiptSeriesConfiguration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
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
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
