import { z } from 'zod';

export const createSocietySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Society name is required'),
    code: z.string().min(1, 'Society code is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    units: z.number().int().positive('Number of units must be positive'),
  }),
});

export const grantAccessSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    mobile: z.string().optional(),
    accessRole: z.enum(['ADMIN', 'COMMITTEE', 'VIEWER']),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});
