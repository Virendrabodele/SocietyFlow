import { Response } from 'express';
import { getPrismaClient } from '../config/database';
import { sendSuccessResponse, sendErrorResponse, AppError } from '../utils/response';
import { createAuditLog } from '../utils/audit';
import { AuthRequest } from '../middleware/auth';

export const createMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, unitNo, phone, email, status, variables } = req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if unit number already exists
    const existingMember = await prisma.member.findUnique({
      where: {
        societyId_unitNo: {
          societyId,
          unitNo,
        },
      },
    });

    if (existingMember) {
      throw new AppError('Member with this unit number already exists', 400);
    }

    // Create member
    const member = await prisma.member.create({
      data: {
        societyId,
        name,
        unitNo,
        phone: phone || null,
        email: email || null,
        status: status || 'ACTIVE',
        variables: variables || {},
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'member_create',
      entityType: 'member',
      entityId: member.id,
      payload: { name, unitNo },
    });

    sendSuccessResponse(res, member, 'Member created successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const bulkCreateMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { members } = req.body;
    const societyId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    if (!Array.isArray(members) || members.length === 0) {
      throw new AppError('Members array is required and must not be empty', 400);
    }

    const prisma = getPrismaClient();

    // Check for duplicate unit numbers in the request
    const unitNos = members.map((m) => m.unitNo);
    const uniqueUnitNos = new Set(unitNos);
    if (unitNos.length !== uniqueUnitNos.size) {
      throw new AppError('Duplicate unit numbers found in request', 400);
    }

    // Check for existing unit numbers
    const existingMembers = await prisma.member.findMany({
      where: {
        societyId,
        unitNo: { in: unitNos },
      },
    });

    if (existingMembers.length > 0) {
      const existingUnitNos = existingMembers.map((m) => m.unitNo);
      throw new AppError(
        `Members with these unit numbers already exist: ${existingUnitNos.join(', ')}`,
        400
      );
    }

    // Create all members
    const createdMembers = await prisma.member.createMany({
      data: members.map((member) => ({
        societyId,
        name: member.name,
        unitNo: member.unitNo,
        phone: member.phone || null,
        email: member.email || null,
        status: member.status || 'ACTIVE',
        variables: member.variables || {},
      })),
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'member_bulk_create',
      entityType: 'member',
      payload: { count: createdMembers.count },
    });

    sendSuccessResponse(
      res,
      { count: createdMembers.count },
      `${createdMembers.count} members created successfully`
    );
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const getMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const societyId = req.params.id;
    const { status, search } = req.query;

    const prisma = getPrismaClient();

    const where: any = { societyId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { unitNo: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const members = await prisma.member.findMany({
      where,
      orderBy: {
        unitNo: 'asc',
      },
    });

    sendSuccessResponse(res, members, 'Members retrieved successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const updateMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, unitNo, phone, email, status, variables } = req.body;
    const { id: societyId, memberId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if member exists
    const existingMember = await prisma.member.findFirst({
      where: {
        id: memberId,
        societyId,
      },
    });

    if (!existingMember) {
      throw new AppError('Member not found', 404);
    }

    // If updating unit number, check for conflicts
    if (unitNo && unitNo !== existingMember.unitNo) {
      const conflictMember = await prisma.member.findUnique({
        where: {
          societyId_unitNo: {
            societyId,
            unitNo,
          },
        },
      });

      if (conflictMember) {
        throw new AppError('Another member with this unit number already exists', 400);
      }
    }

    // Update member
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        ...(name && { name }),
        ...(unitNo && { unitNo }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(status && { status }),
        ...(variables !== undefined && { variables }),
      },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'member_update',
      entityType: 'member',
      entityId: memberId,
      payload: { name, unitNo, status },
    });

    sendSuccessResponse(res, updatedMember, 'Member updated successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};

export const deleteMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: societyId, memberId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const prisma = getPrismaClient();

    // Check if member exists
    const existingMember = await prisma.member.findFirst({
      where: {
        id: memberId,
        societyId,
      },
    });

    if (!existingMember) {
      throw new AppError('Member not found', 404);
    }

    // Delete member
    await prisma.member.delete({
      where: { id: memberId },
    });

    // Create audit log
    await createAuditLog({
      userId,
      societyId,
      action: 'member_delete',
      entityType: 'member',
      entityId: memberId,
      payload: { name: existingMember.name, unitNo: existingMember.unitNo },
    });

    sendSuccessResponse(res, {}, 'Member deleted successfully');
  } catch (error) {
    sendErrorResponse(res, error);
  }
};
