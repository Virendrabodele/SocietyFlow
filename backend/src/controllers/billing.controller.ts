import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';

export const createBillingHead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, isActive, sortOrder } = req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    const billingHead = await prisma.billingHead.create({
      data: {
        societyId,
        name,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    await createAuditLog({
      userId,
      societyId,
      action: 'billing_head_create',
      entityType: 'billing_head',
      entityId: billingHead.id,
      payload: { name },
    });

    sendSuccessResponse(res, billingHead, 'Billing head created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getBillingHeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const billingHeads = await prisma.billingHead.findMany({
      where: { societyId },
      include: {
        lineItems: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    sendSuccessResponse(res, billingHeads, 'Billing heads retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const createLineItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      basisType,
      rate,
      customKey,
      formulaText,
      frequency,
      taxable,
      isActive,
    } = req.body;
    const { id: societyId, headId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Verify billing head exists
    const billingHead = await prisma.billingHead.findFirst({
      where: {
        id: headId,
        societyId,
      },
    });

    if (!billingHead) {
      throw new AppError('Billing head not found', 404);
    }

    // Validate basis type requirements
    if (basisType === 'PER_CUSTOM_KEY' && !customKey) {
      throw new AppError('Custom key is required for PER_CUSTOM_KEY basis type', 400);
    }

    if (basisType === 'FORMULA' && !formulaText) {
      throw new AppError('Formula text is required for FORMULA basis type', 400);
    }

    const lineItem = await prisma.billingLineItem.create({
      data: {
        billingHeadId: headId,
        societyId,
        name,
        basisType,
        rate,
        customKey: customKey || null,
        formulaText: formulaText || null,
        frequency: frequency || 'MONTHLY',
        taxable: taxable ?? false,
        isActive: isActive ?? true,
      },
    });

    await createAuditLog({
      userId,
      societyId,
      action: 'line_item_create',
      entityType: 'billing_line_item',
      entityId: lineItem.id,
      payload: { name, basisType, rate },
    });

    sendSuccessResponse(res, lineItem, 'Line item created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateLineItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      basisType,
      rate,
      customKey,
      formulaText,
      frequency,
      taxable,
      isActive,
    } = req.body;
    const { id: societyId, lineItemId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if line item exists
    const existingLineItem = await prisma.billingLineItem.findFirst({
      where: {
        id: lineItemId,
        societyId,
      },
    });

    if (!existingLineItem) {
      throw new AppError('Line item not found', 404);
    }

    const updatedLineItem = await prisma.billingLineItem.update({
      where: { id: lineItemId },
      data: {
        ...(name && { name }),
        ...(basisType && { basisType }),
        ...(rate !== undefined && { rate }),
        ...(customKey !== undefined && { customKey: customKey || null }),
        ...(formulaText !== undefined && { formulaText: formulaText || null }),
        ...(frequency && { frequency }),
        ...(taxable !== undefined && { taxable }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await createAuditLog({
      userId,
      societyId,
      action: 'line_item_update',
      entityType: 'billing_line_item',
      entityId: lineItemId,
      payload: { name, basisType, rate },
    });

    sendSuccessResponse(res, updatedLineItem, 'Line item updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const deleteLineItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: societyId, lineItemId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if line item exists
    const existingLineItem = await prisma.billingLineItem.findFirst({
      where: {
        id: lineItemId,
        societyId,
      },
    });

    if (!existingLineItem) {
      throw new AppError('Line item not found', 404);
    }

    // Soft delete by marking as inactive
    await prisma.billingLineItem.update({
      where: { id: lineItemId },
      data: { isActive: false },
    });

    await createAuditLog({
      userId,
      societyId,
      action: 'line_item_delete',
      entityType: 'billing_line_item',
      entityId: lineItemId,
      payload: { name: existingLineItem.name },
    });

    sendSuccessResponse(res, {}, 'Line item deleted successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
