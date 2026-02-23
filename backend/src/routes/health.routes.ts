import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import Redis from 'ioredis';
import { config } from '../config';

const router = Router();

// Liveness probe - checks if the application is running
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'societyflow-api',
  });
});

// Readiness probe - checks if the application is ready to serve traffic
router.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; message?: string; responseTime?: number }> = {};
  let allHealthy = true;

  // Check database connection
  try {
    const dbStart = Date.now();
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    allHealthy = false;
    checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis connection
  try {
    const redisStart = Date.now();
    const redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    await redis.ping();
    checks.redis = {
      status: 'healthy',
      responseTime: Date.now() - redisStart,
    };
    redis.disconnect();
  } catch (error) {
    // Redis is optional, don't fail if not available
    checks.redis = {
      status: 'degraded',
      message: 'Redis not available (optional)',
    };
  }

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'societyflow-api',
    checks,
  });
});

export default router;
