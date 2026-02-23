import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { getPrismaClient, disconnectPrisma } from './config/database';
import { errorHandler } from './middleware/error-handler';

// Import routes
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import societyRoutes from './routes/society.routes';
import memberRoutes from './routes/member.routes';
import billingRoutes from './routes/billing.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import reminderRoutes from './routes/reminder.routes';
import residentRoutes from './routes/resident.routes';
import complianceRoutes from './routes/compliance.routes';
import reportsRoutes from './routes/reports.routes';
import bankAccountRoutes from './routes/bank-account.routes';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoints (no auth required)
app.use('/health', healthRoutes);

// API routes
const apiPrefix = config.server.apiPrefix;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/societies`, societyRoutes);
app.use(`${apiPrefix}/societies`, memberRoutes);
app.use(`${apiPrefix}/societies`, billingRoutes);
app.use(`${apiPrefix}/societies`, invoiceRoutes);
app.use(`${apiPrefix}/societies`, paymentRoutes);
app.use(`${apiPrefix}/societies`, reminderRoutes);
app.use(`${apiPrefix}/resident`, residentRoutes);
app.use(`${apiPrefix}/societies`, complianceRoutes);
app.use(`${apiPrefix}/societies`, reportsRoutes);
app.use(`${apiPrefix}/societies`, bankAccountRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Received shutdown signal, closing server gracefully...');
  await disconnectPrisma();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = config.server.port;

const startServer = async () => {
  try {
    // Test database connection
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log('✓ Database connected successfully');

    // Start reminder worker (optional, only if Redis is configured)
    if (config.redis.host) {
      try {
        const { scheduleReminderProcessing } = await import('./workers/reminder.worker');
        await scheduleReminderProcessing();
      } catch (error) {
        console.warn('⚠ Reminder worker not started:', error);
      }
    }

    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${config.server.env}`);
      console.log(`✓ API Base URL: http://localhost:${PORT}${apiPrefix}`);
      console.log(`✓ Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
