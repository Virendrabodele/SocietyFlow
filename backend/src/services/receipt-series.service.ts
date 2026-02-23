import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/response';

interface ReceiptSeriesConfigInput {
  prefix?: string;
  includeYear?: boolean;
  includeSocCode?: boolean;
  separator?: string;
  resetOnNewYear?: boolean;
}

export const getReceiptSeriesConfig = async (societyId: string) => {
  const prisma = getPrismaClient();

  let config = await prisma.receiptSeriesConfig.findUnique({
    where: { societyId },
  });

  // Create default config if it doesn't exist
  if (!config) {
    config = await prisma.receiptSeriesConfig.create({
      data: {
        societyId,
        prefix: 'RCPT',
        includeYear: true,
        includeSocCode: true,
        separator: '/',
        currentSequence: 0,
        resetOnNewYear: true,
      },
    });
  }

  return config;
};

export const updateReceiptSeriesConfig = async (societyId: string, data: ReceiptSeriesConfigInput) => {
  const prisma = getPrismaClient();

  const config = await prisma.receiptSeriesConfig.upsert({
    where: { societyId },
    update: data,
    create: {
      societyId,
      prefix: data.prefix || 'RCPT',
      includeYear: data.includeYear ?? true,
      includeSocCode: data.includeSocCode ?? true,
      separator: data.separator || '/',
      currentSequence: 0,
      resetOnNewYear: data.resetOnNewYear ?? true,
    },
  });

  return config;
};

const getFinancialYear = (date: Date): string => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month >= 4) {
    // Apr-Mar financial year
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

export const generateReceiptNumber = async (societyId: string, societyCode: string): Promise<string> => {
  const prisma = getPrismaClient();

  const config = await getReceiptSeriesConfig(societyId);
  const now = new Date();
  const financialYear = getFinancialYear(now);

  // Check if we need to reset sequence for new year
  const currentFY = getFinancialYear(now);
  const lastReceipt = await prisma.receipt.findFirst({
    where: {
      societyId,
      status: { not: 'CANCELLED' },
    },
    orderBy: { issuedOn: 'desc' },
  });

  let shouldResetSequence = false;
  if (config.resetOnNewYear && lastReceipt?.issuedOn) {
    const lastFY = getFinancialYear(lastReceipt.issuedOn);
    shouldResetSequence = lastFY !== currentFY;
  }

  // Increment sequence
  const newSequence = shouldResetSequence ? 1 : config.currentSequence + 1;

  // Update config
  await prisma.receiptSeriesConfig.update({
    where: { societyId },
    data: { currentSequence: newSequence },
  });

  // Build receipt number
  const parts: string[] = [config.prefix];

  if (config.includeSocCode) {
    parts.push(societyCode);
  }

  if (config.includeYear) {
    parts.push(financialYear);
  }

  parts.push(newSequence.toString().padStart(4, '0'));

  return parts.join(config.separator);
};
