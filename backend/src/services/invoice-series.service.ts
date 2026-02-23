import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/response';

interface InvoiceSeriesConfigInput {
  prefix?: string;
  includeYear?: boolean;
  includeSocCode?: boolean;
  separator?: string;
  resetOnNewYear?: boolean;
}

export const getInvoiceSeriesConfig = async (societyId: string) => {
  const prisma = getPrismaClient();

  let config = await prisma.invoiceSeriesConfig.findUnique({
    where: { societyId },
  });

  // Create default config if it doesn't exist
  if (!config) {
    config = await prisma.invoiceSeriesConfig.create({
      data: {
        societyId,
        prefix: 'INV',
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

export const updateInvoiceSeriesConfig = async (societyId: string, data: InvoiceSeriesConfigInput) => {
  const prisma = getPrismaClient();

  const config = await prisma.invoiceSeriesConfig.upsert({
    where: { societyId },
    update: data,
    create: {
      societyId,
      prefix: data.prefix || 'INV',
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

export const generateInvoiceNumber = async (societyId: string, societyCode: string): Promise<string> => {
  const prisma = getPrismaClient();

  const config = await getInvoiceSeriesConfig(societyId);
  const now = new Date();
  const financialYear = getFinancialYear(now);

  // Check if we need to reset sequence for new year
  const currentFY = getFinancialYear(now);
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      societyId,
      invoiceNo: { not: null },
    },
    orderBy: { invoiceDate: 'desc' },
  });

  let shouldResetSequence = false;
  if (config.resetOnNewYear && lastInvoice?.invoiceDate) {
    const lastFY = getFinancialYear(lastInvoice.invoiceDate);
    shouldResetSequence = lastFY !== currentFY;
  }

  // Increment sequence
  const newSequence = shouldResetSequence ? 1 : config.currentSequence + 1;

  // Update config
  await prisma.invoiceSeriesConfig.update({
    where: { societyId },
    data: { currentSequence: newSequence },
  });

  // Build invoice number
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
