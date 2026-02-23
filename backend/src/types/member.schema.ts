import { z } from 'zod';

export const createMemberSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Member name is required'),
    unitNo: z.string().min(1, 'Unit number is required'),
    phone: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).default('ACTIVE'),
    variables: z.record(z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const updateMemberSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    unitNo: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).optional(),
    variables: z.record(z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    memberId: z.string().uuid('Invalid member ID'),
  }),
});

export const bulkCreateMembersSchema = z.object({
  body: z.object({
    members: z.array(
      z.object({
        name: z.string().min(1),
        unitNo: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).default('ACTIVE'),
        variables: z.record(z.unknown()).optional(),
      })
    ),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});
