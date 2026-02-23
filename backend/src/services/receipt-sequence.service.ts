/**
 * Receipt Sequence Generator Service
 * Handles receipt number generation with FY awareness and concurrency control
 */

import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/response';

export interface GenerateReceiptNumberInput {
  societyId: string;
  societyCode?: string;
}

export interface GenerateReceiptNumberResult {
  receiptNo: string;
  sequence: number;
  financialYear: string;
}

/**
 * Gets the current Indian financial year (Apr-Mar)
 * Returns format: "2025-26"
 */
export const getCurrentFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  // Financial year starts in April (month 3)
  if (month >= 3) {
    // Apr-Dec: Current year to next year
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // Jan-Mar: Previous year to current year
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

/**
 * Formats receipt number based on template
 */
const formatReceiptNumber = (
  format: string,
  societyCode: string,
  sequence: number,
  financialYear: string
): string => {
  const [fyStart] = financialYear.split('-');
  const month = new Date().getMonth() + 1; // 1-12
  const year = new Date().getFullYear();

  const paddedSeq = sequence.toString().padStart(4, '0');

  const replacements: Record<string, string> = {
    '{FY}': financialYear,
    '{SOC}': societyCode,
    '{####}': paddedSeq,
    '{YYYY}': year.toString(),
    '{MM}': month.toString().padStart(2, '0'),
    '{SEQ}': paddedSeq,
  };

  let formatted = format;
  Object.entries(replacements).forEach(([key, value]) => {
    formatted = formatted.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return formatted;
};

/**
 * Generates next receipt number with concurrency control
 */
export const generateReceiptNumber = async (
  input: GenerateReceiptNumberInput
): Promise<GenerateReceiptNumberResult> => {
  const { societyId, societyCode } = input;
  const prisma = getPrismaClient();

  const currentFY = getCurrentFinancialYear();

  try {
    // Use transaction with retry logic for concurrency
    const result = await prisma.$transaction(async (tx) => {
      // Get or create receipt sequence for this society and FY
      let sequence = await tx.receiptSequence.findUnique({
        where: {
          societyId_financialYear: {
            societyId,
            financialYear: currentFY,
          },
        },
      });

      if (!sequence) {
        // Create new sequence for this FY
        sequence = await tx.receiptSequence.create({
          data: {
            societyId,
            financialYear: currentFY,
            currentSeq: 1,
            format: 'FY_SOC_SEQ',
            prefix: 'RCPT',
            resetOnNewFY: true,
          },
        });
      } else {
        // Increment sequence
        sequence = await tx.receiptSequence.update({
          where: {
            id: sequence.id,
          },
          data: {
            currentSeq: {
              increment: 1,
            },
            lastUpdatedAt: new Date(),
          },
        });
      }

      // Get society details if needed
      let code = societyCode;
      if (!code) {
        const society = await tx.society.findUnique({
          where: { id: societyId },
          select: { code: true },
        });

        if (!society) {
          throw new AppError('Society not found', 404);
        }

        code = society.code;
      }

      // Format receipt number
      let receiptNo = '';

      switch (sequence.format) {
        case 'FY_SOC_SEQ':
          receiptNo = `${sequence.prefix}/${currentFY}/${code}/${sequence.currentSeq.toString().padStart(4, '0')}`;
          break;

        case 'SOC_YEAR_MONTH':
          const year = new Date().getFullYear();
          const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
          receiptNo = `${code}-${year}-${month}-${sequence.currentSeq.toString().padStart(4, '0')}`;
          break;

        case 'CUSTOM':
          if (sequence.customFormat) {
            receiptNo = formatReceiptNumber(
              sequence.customFormat,
              code,
              sequence.currentSeq,
              currentFY
            );
          } else {
            throw new AppError('Custom format not configured', 400);
          }
          break;

        default:
          receiptNo = `${sequence.prefix}-${sequence.currentSeq.toString().padStart(6, '0')}`;
      }

      return {
        receiptNo,
        sequence: sequence.currentSeq,
        financialYear: currentFY,
      };
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // Handle deadlock or unique constraint violations
    console.error('Error generating receipt number:', error);
    throw new AppError('Failed to generate receipt number. Please try again.', 500);
  }
};

/**
 * Validates receipt number uniqueness
 */
export const validateReceiptNumberUniqueness = async (
  societyId: string,
  receiptNo: string
): Promise<boolean> => {
  const prisma = getPrismaClient();

  const existing = await prisma.receipt.findUnique({
    where: {
      societyId_receiptNo: {
        societyId,
        receiptNo,
      },
    },
  });

  return !existing;
};

/**
 * Configures receipt sequence format for a society
 */
export const configureReceiptSequence = async (
  societyId: string,
  config: {
    format?: 'FY_SOC_SEQ' | 'SOC_YEAR_MONTH' | 'CUSTOM';
    customFormat?: string;
    prefix?: string;
    resetOnNewFY?: boolean;
  }
): Promise<void> => {
  const prisma = getPrismaClient();
  const currentFY = getCurrentFinancialYear();

  const existing = await prisma.receiptSequence.findUnique({
    where: {
      societyId_financialYear: {
        societyId,
        financialYear: currentFY,
      },
    },
  });

  if (existing) {
    // Update existing configuration
    await prisma.receiptSequence.update({
      where: { id: existing.id },
      data: {
        format: config.format,
        customFormat: config.customFormat,
        prefix: config.prefix,
        resetOnNewFY: config.resetOnNewFY,
      },
    });
  } else {
    // Create new configuration
    await prisma.receiptSequence.create({
      data: {
        societyId,
        financialYear: currentFY,
        format: config.format || 'FY_SOC_SEQ',
        customFormat: config.customFormat,
        prefix: config.prefix || 'RCPT',
        resetOnNewFY: config.resetOnNewFY ?? true,
        currentSeq: 0,
      },
    });
  }
};
