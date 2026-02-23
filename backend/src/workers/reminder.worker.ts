import { Worker, Queue } from 'bullmq';
import { config } from '../config';
import { processScheduledReminders } from '../services/reminder.service';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};

// Create reminder queue
export const reminderQueue = new Queue('reminders', { connection });

// Create worker to process reminder jobs
export const reminderWorker = new Worker(
  'reminders',
  async (job) => {
    console.log(`Processing reminder job: ${job.id}`);

    try {
      await processScheduledReminders();
      return { success: true, processed: true };
    } catch (error) {
      console.error('Error processing reminders:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one batch at a time
  }
);

// Event listeners
reminderWorker.on('completed', (job) => {
  console.log(`Reminder job ${job.id} completed successfully`);
});

reminderWorker.on('failed', (job, err) => {
  console.error(`Reminder job ${job?.id} failed:`, err);
});

// Schedule recurring reminder processing (every 5 minutes)
export async function scheduleReminderProcessing() {
  await reminderQueue.add(
    'process-reminders',
    {},
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 200, // Keep last 200 failed jobs
    }
  );

  console.log('✓ Reminder processing scheduled (every 5 minutes)');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down reminder worker...');
  await reminderWorker.close();
  await reminderQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down reminder worker...');
  await reminderWorker.close();
  await reminderQueue.close();
  process.exit(0);
});
