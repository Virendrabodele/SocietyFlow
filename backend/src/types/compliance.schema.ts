import { z } from 'zod';

// Tax Configuration Schemas
export const createTaxConfigSchema = z.object({
  body: z.object({
    gstEnabled: z.boolean().default(false),
    defaultGstRate: z.number().min(0).max(100).default(18),
    placeOfSupply: z.string().min(1, 'Place of supply is required'),
    isInterState: z.boolean().default(false),
    itemTaxRates: z.record(z.string(), z.number().min(0).max(100)).optional(),
    exemptionThreshold: z.number().min(0).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const updateTaxConfigSchema = z.object({
  body: z.object({
    gstEnabled: z.boolean().optional(),
    defaultGstRate: z.number().min(0).max(100).optional(),
    placeOfSupply: z.string().min(1).optional(),
    isInterState: z.boolean().optional(),
    itemTaxRates: z.record(z.string(), z.number().min(0).max(100)).optional(),
    exemptionThreshold: z.number().min(0).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

// Receipt Sequence Schemas
export const configureReceiptSequenceSchema = z.object({
  body: z.object({
    format: z.enum(['FY_SOC_SEQ', 'SOC_YEAR_MONTH', 'CUSTOM']).default('FY_SOC_SEQ'),
    customFormat: z.string().optional(),
    prefix: z.string().default('RCPT'),
    resetOnNewFY: z.boolean().default(true),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

// Month Closure Schemas
export const createMonthClosureSchema = z.object({
  body: z.object({
    periodMonth: z.number().min(1).max(12),
    periodYear: z.number().min(2000).max(2100),
    status: z.enum(['DRAFT', 'REVIEWED', 'APPROVED', 'LOCKED']).default('DRAFT'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const updateMonthClosureStatusSchema = z.object({
  body: z.object({
    status: z.enum(['DRAFT', 'REVIEWED', 'APPROVED', 'LOCKED']),
    unlockReason: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    closureId: z.string().uuid('Invalid closure ID'),
  }),
});

export const monthEndStatementQuerySchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{1,2}$/, 'Invalid month').optional(),
    year: z.string().regex(/^\d{4}$/, 'Invalid year').optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

// Society Compliance Update Schema
export const updateSocietyComplianceSchema = z.object({
  body: z.object({
    registeredAddress: z.string().min(1).optional(),
    gstin: z.string().length(15).optional(),
    pan: z.string().length(10).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().min(10).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});
