import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/response';

interface TaxConfigInput {
  gstEnabled: boolean;
  gstin?: string;
  taxRegime?: 'CGST_SGST' | 'IGST';
  defaultTaxRate?: number;
  taxThreshold?: number;
  roundingPolicy?: string;
}

export const getTaxConfig = async (societyId: string) => {
  const prisma = getPrismaClient();

  let taxConfig = await prisma.taxConfig.findUnique({
    where: { societyId },
  });

  // Create default tax config if it doesn't exist
  if (!taxConfig) {
    taxConfig = await prisma.taxConfig.create({
      data: {
        societyId,
        gstEnabled: false,
        taxRegime: 'CGST_SGST',
        defaultTaxRate: 18,
        roundingPolicy: 'NEAREST_RUPEE',
      },
    });
  }

  return taxConfig;
};

export const updateTaxConfig = async (societyId: string, data: TaxConfigInput) => {
  const prisma = getPrismaClient();

  // Validate GSTIN if GST is enabled
  if (data.gstEnabled && !data.gstin) {
    throw new AppError('GSTIN is required when GST is enabled', 400);
  }

  const taxConfig = await prisma.taxConfig.upsert({
    where: { societyId },
    update: {
      ...data,
      gstin: data.gstin || null,
      taxThreshold: data.taxThreshold || null,
    },
    create: {
      societyId,
      gstEnabled: data.gstEnabled,
      gstin: data.gstin || null,
      taxRegime: data.taxRegime || 'CGST_SGST',
      defaultTaxRate: data.defaultTaxRate || 18,
      taxThreshold: data.taxThreshold || null,
      roundingPolicy: data.roundingPolicy || 'NEAREST_RUPEE',
    },
  });

  return taxConfig;
};

interface TaxCalculationInput {
  lineItems: Array<{
    amount: number;
    taxable: boolean;
    taxRate?: number;
  }>;
  taxConfig: {
    gstEnabled: boolean;
    taxRegime: 'CGST_SGST' | 'IGST';
    defaultTaxRate: number;
    roundingPolicy: string;
  };
}

interface TaxCalculationResult {
  subtotal: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  roundingAmount: number;
  totalAmount: number;
  taxBreakdown: Array<{
    taxRate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
}

export const calculateTax = (input: TaxCalculationInput): TaxCalculationResult => {
  const { lineItems, taxConfig } = input;

  let subtotal = 0;
  let taxableAmount = 0;

  // Group line items by tax rate
  const taxRateGroups: Map<number, number> = new Map();

  for (const item of lineItems) {
    subtotal += item.amount;

    if (item.taxable && taxConfig.gstEnabled) {
      const itemTaxRate = item.taxRate || taxConfig.defaultTaxRate;
      taxableAmount += item.amount;

      const currentAmount = taxRateGroups.get(itemTaxRate) || 0;
      taxRateGroups.set(itemTaxRate, currentAmount + item.amount);
    }
  }

  // Calculate tax for each rate group
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const taxBreakdown: Array<{
    taxRate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }> = [];

  for (const [taxRate, taxableValue] of taxRateGroups) {
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    if (taxConfig.taxRegime === 'CGST_SGST') {
      cgst = (taxableValue * taxRate) / (2 * 100);
      sgst = (taxableValue * taxRate) / (2 * 100);
      totalTax = cgst + sgst;
    } else {
      igst = (taxableValue * taxRate) / 100;
      totalTax = igst;
    }

    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    taxBreakdown.push({
      taxRate,
      taxableValue,
      cgst,
      sgst,
      igst,
      totalTax,
    });
  }

  const taxAmount = totalCgst + totalSgst + totalIgst;
  const totalBeforeRounding = subtotal + taxAmount;

  // Apply rounding
  let roundingAmount = 0;
  let totalAmount = totalBeforeRounding;

  if (taxConfig.roundingPolicy === 'NEAREST_RUPEE') {
    totalAmount = Math.round(totalBeforeRounding);
    roundingAmount = totalAmount - totalBeforeRounding;
  } else if (taxConfig.roundingPolicy === 'TWO_DECIMALS') {
    totalAmount = Math.round(totalBeforeRounding * 100) / 100;
    roundingAmount = totalAmount - totalBeforeRounding;
  }

  return {
    subtotal,
    taxableAmount,
    cgstAmount: totalCgst,
    sgstAmount: totalSgst,
    igstAmount: totalIgst,
    taxAmount,
    roundingAmount,
    totalAmount,
    taxBreakdown,
  };
};
