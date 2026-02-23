import { Request, Response, NextFunction } from 'express';
import { getPrismaClient } from '../config/database';
import { AuthRequest } from './auth';

export const verifySocietyAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const societyId = req.params.id || req.params.societyId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!societyId) {
      res.status(400).json({
        success: false,
        message: 'Society ID is required',
      });
      return;
    }

    // Master admin has access to all societies
    if (userRole === 'MASTER_ADMIN') {
      next();
      return;
    }

    // Check if user has explicit access to this society
    const prisma = getPrismaClient();
    const access = await prisma.societyAccess.findUnique({
      where: {
        societyId_userId: {
          societyId,
          userId,
        },
      },
    });

    if (!access) {
      res.status(403).json({
        success: false,
        message: 'You do not have access to this society',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying society access',
    });
  }
};
