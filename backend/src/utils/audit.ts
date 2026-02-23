import { getPrismaClient } from '../config/database';

interface AuditLogData {
  userId: string;
  societyId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  const prisma = getPrismaClient();

  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        societyId: data.societyId || null,
        action: data.action,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        payload: (data.payload || {}) as any,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create audit log:', error);
  }
};
