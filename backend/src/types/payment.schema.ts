import { z } from 'zod';

// ============================================
// BANK ACCOUNT SCHEMAS
// ============================================

export const createBankAccountSchema = z.object({
  body: z.object({
    bankName: z.string().min(1, 'Bank name is required'),
    accountHolderName: z.string().min(1, 'Account holder name is required'),
    accountNumber: z.string().min(9, 'Account number must be at least 9 digits').max(18, 'Account number must be at most 18 digits'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
    upiId: z.string().optional(),
    qrCodeUrl: z.string().url().optional().or(z.literal('')),
    isDefault: z.boolean().optional().default(false),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const getBankAccountsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
  query: z.object({
    includeInactive: z.string().optional().transform((val) => val === 'true'),
  }).optional(),
});

export const updateBankAccountSchema = z.object({
  body: z.object({
    bankName: z.string().min(1).optional(),
    accountHolderName: z.string().min(1).optional(),
    upiId: z.string().optional(),
    qrCodeUrl: z.string().url().optional().or(z.literal('')),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    accountId: z.string().uuid('Invalid account ID'),
  }),
});

// ============================================
// PAYMENT SUBMISSION SCHEMAS
// ============================================

export const submitPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be positive'),
    transactionRef: z.string().optional(),
    paidDate: z.string().datetime().or(z.date()),
    bankAccountId: z.string().uuid().optional(),
    proofFiles: z.array(z.object({
      fileName: z.string(),
      fileUrl: z.string(),
      fileSize: z.number().positive(),
      mimeType: z.string(),
    })).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    invoiceId: z.string().uuid('Invalid invoice ID'),
  }),
});

export const verifyPaymentSubmissionSchema = z.object({
  body: z.object({
    action: z.enum(['verify', 'reject']),
    verificationNotes: z.string().optional(),
    rejectionReason: z.string().optional(),
    createReceipt: z.boolean().optional().default(true),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
    submissionId: z.string().uuid('Invalid submission ID'),
  }),
});

export const getPaymentSubmissionsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
  query: z.object({
    status: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED']).optional(),
    invoiceId: z.string().uuid().optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  }).optional(),
});

// ============================================
// REMINDER SCHEMAS
// ============================================

export const createReminderRuleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Rule name is required'),
    type: z.enum(['PRE_DUE_D7', 'PRE_DUE_D3', 'OVERDUE_D1', 'CUSTOM']),
    daysOffset: z.number().int(),
    channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
    emailSubject: z.string().optional(),
    emailBody: z.string().optional(),
    smsBody: z.string().optional(),
    whatsappBody: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  }).refine(
    (data) => {
      if (data.channel === 'EMAIL') {
        return !!data.emailSubject && !!data.emailBody;
      }
      if (data.channel === 'SMS') {
        return !!data.smsBody;
      }
      if (data.channel === 'WHATSAPP') {
        return !!data.whatsappBody;
      }
      return true;
    },
    {
      message: 'Template content is required for the selected channel',
    }
  ),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const getReminderRulesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
  query: z.object({
    includeInactive: z.string().optional().transform((val) => val === 'true'),
  }).optional(),
});

export const testReminderSchema = z.object({
  body: z.object({
    ruleId: z.string().uuid('Invalid rule ID'),
    testEmail: z.string().email().optional(),
    testPhone: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const scheduleRemindersSchema = z.object({
  body: z.object({
    periodMonth: z.number().int().min(1).max(12),
    periodYear: z.number().int().min(2020).max(2100),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

// ============================================
// APPROVAL SCHEMAS
// ============================================

export const createApprovalRequestSchema = z.object({
  body: z.object({
    type: z.enum(['BILLING_RATE_CHANGE', 'WAIVER_DISCOUNT', 'VOID_RECEIPT', 'EDIT_VERIFIED_PAYMENT', 'BACKDATED_INVOICE']),
    entityType: z.string(),
    entityId: z.string().uuid(),
    description: z.string().min(1, 'Description is required'),
    oldState: z.record(z.string(), z.unknown()).optional(),
    newState: z.record(z.string(), z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
});

export const processApprovalSchema = z.object({
  body: z.object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional(),
    comment: z.string().optional(),
  }),
  params: z.object({
    approvalId: z.string().uuid('Invalid approval ID'),
  }),
});

export const getApprovalsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid society ID'),
  }),
  query: z.object({
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED']).optional(),
    type: z.enum(['BILLING_RATE_CHANGE', 'WAIVER_DISCOUNT', 'VOID_RECEIPT', 'EDIT_VERIFIED_PAYMENT', 'BACKDATED_INVOICE']).optional(),
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  }).optional(),
});

// ============================================
// RESIDENT PORTAL SCHEMAS
// ============================================

export const getResidentDashboardSchema = z.object({
  query: z.object({
    societyId: z.string().uuid('Invalid society ID').optional(),
  }).optional(),
});

export const getResidentInvoicesSchema = z.object({
  query: z.object({
    societyId: z.string().uuid('Invalid society ID').optional(),
    status: z.enum(['DRAFT', 'GENERATED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
    fromMonth: z.string().transform((val) => (val ? parseInt(val, 10) : undefined)).optional(),
    fromYear: z.string().transform((val) => (val ? parseInt(val, 10) : undefined)).optional(),
    toMonth: z.string().transform((val) => (val ? parseInt(val, 10) : undefined)).optional(),
    toYear: z.string().transform((val) => (val ? parseInt(val, 10) : undefined)).optional(),
    page: z.string().transform((val) => (val ? parseInt(val, 10) : 1)).optional(),
    limit: z.string().transform((val) => (val ? parseInt(val, 10) : 50)).optional(),
  }).optional(),
});

export const getResidentReceiptsSchema = z.object({
  query: z.object({
    societyId: z.string().uuid('Invalid society ID').optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    page: z.string().transform((val) => (val ? parseInt(val, 10) : 1)).optional(),
    limit: z.string().transform((val) => (val ? parseInt(val, 10) : 50)).optional(),
  }).optional(),
});

export const getResidentPaymentsSchema = z.object({
  query: z.object({
    societyId: z.string().uuid('Invalid society ID').optional(),
    status: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED']).optional(),
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  }).optional(),
});

// Type exports
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>['body'];
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>['body'];
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>['body'];
export type VerifyPaymentSubmissionInput = z.infer<typeof verifyPaymentSubmissionSchema>['body'];
export type CreateReminderRuleInput = z.infer<typeof createReminderRuleSchema>['body'];
export type TestReminderInput = z.infer<typeof testReminderSchema>['body'];
export type ScheduleRemindersInput = z.infer<typeof scheduleRemindersSchema>['body'];
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>['body'];
export type ProcessApprovalInput = z.infer<typeof processApprovalSchema>['body'];
