import { z } from 'zod';

export const createBillingHeadSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Billing head name is required'),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const createLineItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Line item name is required'),
    basisType: z.enum([
      'FLAT',
      'PER_BHK',
      'PER_SQFT',
      'PER_WATER_READING',
      'PER_DG_READING',
      'PER_METER_READING',
      'PER_CUSTOM_KEY',
      'FORMULA',
    ]),
    rate: z.number().nonnegative('Rate must be non-negative'),
    customKey: z.string().optional(),
    formulaText: z.string().optional(),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']).default('MONTHLY'),
    taxable: z.boolean().default(false),
    isActive: z.boolean().default(true),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    headId: z.string().uuid('Invalid billing head ID'),
  }),
});

export const updateLineItemSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    basisType: z
      .enum([
        'FLAT',
        'PER_BHK',
        'PER_SQFT',
        'PER_WATER_READING',
        'PER_DG_READING',
        'PER_METER_READING',
        'PER_CUSTOM_KEY',
        'FORMULA',
      ])
      .optional(),
    rate: z.number().nonnegative().optional(),
    customKey: z.string().optional(),
    formulaText: z.string().optional(),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME']).optional(),
    taxable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    lineItemId: z.string().uuid('Invalid line item ID'),
  }),
});
