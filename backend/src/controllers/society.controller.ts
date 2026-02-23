import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';

export const createSociety = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, city, state, units } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Only MASTER_ADMIN can create societies
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

    // Create society
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

    // Grant admin access to creator
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
      action: 'society_create',
      entityType: 'society',
      entityId: society.id,
      payload: { name, code, city, state, units },
    });

    sendSuccessResponse(res, society, 'Society created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getSocieties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Master admin can see all societies
    if (userRole === 'MASTER_ADMIN') {
      const societies = await prisma.society.findMany({
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              members: true,
              invoices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      sendSuccessResponse(res, societies, 'Societies retrieved successfully');
      return;
    }

    // Other users see only societies they have access to
    const societyAccess = await prisma.societyAccess.findMany({
      where: { userId },
      include: {
        society: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                members: true,
                invoices: true,
              },
            },
          },
        },
      },
    });

    const societies = societyAccess.map((access) => ({
      ...access.society,
      userAccessRole: access.accessRole,
    }));

    sendSuccessResponse(res, societies, 'Societies retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const grantSocietyAccess = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, mobile, accessRole } = req.body;
    const societyId = req.params.id;
    const grantedByUserId = req.user?.userId;

    if (!grantedByUserId) {
      throw new AppError('Authentication required', 401);
    }

    if (!email && !mobile) {
      throw new AppError('Either email or mobile is required', 400);
    }

    const prisma = getPrismaClient();

    // Find user by email or mobile
    const targetUser = await prisma.user.findFirst({
      where: email ? { email } : { mobile },
    });

    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Check if access already exists
    const existingAccess = await prisma.societyAccess.findUnique({
      where: {
        societyId_userId: {
          societyId,
          userId: targetUser.id,
        },
      },
    });

    if (existingAccess) {
      throw new AppError('User already has access to this society', 400);
    }

    // Grant access
    const access = await prisma.societyAccess.create({
      data: {
        societyId,
        userId: targetUser.id,
        accessRole,
        grantedByUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      userId: grantedByUserId,
      societyId,
      action: 'society_access_grant',
      entityType: 'society_access',
      entityId: access.id,
      payload: { targetUserId: targetUser.id, accessRole },
    });

    sendSuccessResponse(res, access, 'Access granted successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getSocietyAccess = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const prisma = getPrismaClient();

    const accessList = await prisma.societyAccess.findMany({
      where: { societyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        grantedAt: 'desc',
      },
    });

    sendSuccessResponse(res, accessList, 'Access list retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
