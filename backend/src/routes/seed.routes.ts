// backend/src/routes/seed.routes.ts
// ONE-TIME USE ONLY - Delete this file after seeding your database!

import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { hashPassword } from '../utils/password';

const router = Router();

// Secret key to prevent unauthorized seeding
const SEED_SECRET = process.env.SEED_SECRET || 'societyflow-seed-2026';

router.get('/run', async (req: Request, res: Response) => {
  const { secret } = req.query;

  if (secret !== SEED_SECRET) {
    res.status(403).json({ success: false, message: 'Invalid seed secret' });
    return;
  }

  try {
    const prisma = getPrismaClient();

    // Create master admin
    const masterAdmin = await prisma.user.upsert({
      where: { email: 'admin@societyflow.com' },
      update: {},
      create: {
        name: 'Master Admin',
        email: 'admin@societyflow.com',
        mobile: '9922232785',
        passwordHash: await hashPassword('Admin@123'),
        role: 'MASTER_ADMIN',
        isActive: true,
      },
    });

    // Create a sample society
    const society = await prisma.society.upsert({
      where: { code: 'GPA001' },
      update: {},
      create: {
        name: 'Green Park Apartments',
        code: 'GPA001',
        city: 'Mumbai',
        state: 'Maharashtra',
        units: 50,
        createdByUserId: masterAdmin.id,
      },
    });

    // Grant admin access
    await prisma.societyAccess.upsert({
      where: {
        societyId_userId: {
          societyId: society.id,
          userId: masterAdmin.id,
        },
      },
      update: {},
      create: {
        societyId: society.id,
        userId: masterAdmin.id,
        accessRole: 'ADMIN',
        grantedByUserId: masterAdmin.id,
      },
    });

    res.json({
      success: true,
      message: '✅ Database seeded successfully! IMPORTANT: Remove the seed route from your code now.',
      credentials: {
        email: 'admin@societyflow.com',
        password: 'Admin@123',
        role: 'MASTER_ADMIN',
      },
      society: {
        name: society.name,
        code: society.code,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Seed failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
