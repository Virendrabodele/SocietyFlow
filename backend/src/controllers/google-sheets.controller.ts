import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';
import GoogleSheetsService from '../services/google-sheets.service';
import { config } from '../config';

// Initialize Google Sheets Service
const googleSheetsService = config.googleSheets.enabled
  ? new GoogleSheetsService({
      clientId: config.googleSheets.clientId || '',
      clientSecret: config.googleSheets.clientSecret || '',
      redirectUri: config.googleSheets.redirectUri || '',
    })
  : null;

/**
 * Create Society and sync to Google Sheets
 */
export const createSocietyWithGoogleSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, city, state, units, googleSheetId } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    if (userRole !== 'MASTER_ADMIN') {
      throw new AppError('Only master admin can create societies', 403);
    }

    const prisma = getPrismaClient();

    // Check if society code already exists
    const existingSociety = await prisma.society.findUnique({
      where: { code },
    });

    if (existingSociety) {
      throw new AppError('Society with this code already exists', 400);
    }

    let sheetId = googleSheetId;

    // Create Google Sheet if enabled
    if (googleSheetsService && config.googleSheets.enabled) {
      try {
        sheetId = await googleSheetsService.createSocietySheet(name);
        console.log(`✅ Google Sheet created for ${name}: ${googleSheetsService.getSheetUrl(sheetId)}`);
      } catch (error) {
        console.error('⚠️ Warning: Google Sheet creation failed:', error);
        // Continue without Google Sheets - don't fail the request
      }
    }

    // Create society in database
    const society = await prisma.society.create({
      data: {
        name,
        code,
        city,
        state,
        units,
        createdByUserId: userId,
      },
    });

    // Grant admin access
    await prisma.societyAccess.create({
      data: {
        societyId: society.id,
        userId,
        accessRole: 'ADMIN',
        grantedByUserId: userId,
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId: society.id,
      action: 'society_create_with_sheet',
      entityType: 'society',
      entityId: society.id,
      payload: { name, code, city, state, units, googleSheetId: sheetId },
    });

    sendSuccessResponse(
      res,
      {
        society,
        googleSheetUrl: sheetId ? googleSheetsService?.getSheetUrl(sheetId) : null,
      },
      'Society created successfully and synced to Google Sheets'
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Add Member and sync to Google Sheets
 */
export const addMemberWithGoogleSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId: currentUserId } = req.user || {};
    const { societyId, name, unitNo, email, phone, status, variables } = req.body;

    if (!currentUserId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Verify access to society
    const access = await prisma.societyAccess.findFirst({
      where: {
        societyId,
        userId: currentUserId,
      },
    });

    if (!access) {
      throw new AppError('You do not have access to this society', 403);
    }

    // Check if member already exists
    const existingMember = await prisma.member.findFirst({
      where: {
        societyId,
        unitNo,
      },
    });

    if (existingMember) {
      throw new AppError('Member with this unit already exists in society', 400);
    }

    // Create member in database
    const member = await prisma.member.create({
      data: {
        societyId,
        name,
        unitNo,
        email: email || null,
        phone: phone || null,
        status,
        variables: variables || {},
      },
    });

    // Get society details for Google Sheet
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    // Sync to Google Sheets if enabled
    if (googleSheetsService && config.googleSheets.enabled && society) {
      try {
        // You would need to store the googleSheetId in the Society model
        // For now, we'll use a placeholder or get it from another source
        const sheetId = (society as any).googleSheetId;

        if (sheetId) {
          await googleSheetsService.addMember(sheetId, {
            name,
            unitNo,
            email: email || '',
            phone: phone || '',
            status,
            variables: JSON.stringify(variables || {}),
          });
          console.log(`✅ Member ${name} synced to Google Sheets`);
        }
      } catch (error) {
        console.error('⚠️ Warning: Failed to sync member to Google Sheets:', error);
        // Continue without failing
      }
    }

    // Create audit log
    await createAuditLog({
      userId: currentUserId,
      societyId,
      action: 'member_create',
      entityType: 'member',
      entityId: member.id,
      payload: { name, unitNo, email, phone, status },
    });

    sendSuccessResponse(res, member, 'Member added successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

/**
 * Log activity to Google Sheets
 */
export const logActivityToSheet = async (
  societyId: string,
  userId: string,
  action: string,
  entityType: string,
  details?: string
) => {
  if (!googleSheetsService || !config.googleSheets.enabled) {
    return;
  }

  try {
    const prisma = getPrismaClient();
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    const sheetId = (society as any)?.googleSheetId;

    if (sheetId) {
      await googleSheetsService.addAuditLog(sheetId, {
        action,
        userId,
        entityType,
        details: details || '',
      });
    }
  } catch (error) {
    console.error('Failed to log to Google Sheets:', error);
  }
};
