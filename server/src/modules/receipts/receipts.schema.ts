import { z } from 'zod';
import { OperationStatus } from '@prisma/client';

export const CreateReceiptSchema = z.object({
  body: z.object({
    partner_id: z.coerce.string().min(1, 'Partner ID is required'),
    warehouse_id: z.coerce.string().min(1, 'Warehouse ID is required'),
    destination_location_id: z.coerce
      .string()
      .min(1, 'Destination location ID is required'),
    scheduled_date: z
      .string()
      .datetime({ message: 'scheduled_date must be a valid ISO 8601 date string' }),
    notes: z.string().optional().nullable(),
    lines: z
      .array(
        z.object({
          product_id: z.coerce.string().min(1, 'Product ID is required'),
          uom_id: z.coerce.string().min(1, 'UoM ID is required'),
          quantity_planned: z.coerce
            .number()
            .positive('quantity_planned must be greater than 0'),
        })
      )
      .min(1, 'At least one line is required'),
  }),
});

export const UpdateReceiptSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Receipt ID must be a numeric string'),
  }),
  body: z.object({
    responsible_user_id: z.coerce.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    lines: z
      .array(
        z.object({
          id: z.coerce.string().optional().nullable(),
          product_id: z.coerce.string().min(1, 'Product ID is required'),
          uom_id: z.coerce.string().min(1, 'UoM ID is required'),
          quantity_planned: z.coerce
            .number()
            .positive('quantity_planned must be greater than 0'),
          quantity_done: z.coerce
            .number()
            .min(0, 'quantity_done cannot be negative')
            .optional(),
        })
      )
      .optional(),
  }),
});

export const GetReceiptsQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(OperationStatus).optional(),
    warehouse_id: z.coerce.string().optional(),
    search: z.string().optional(),
    view: z.enum(['list', 'kanban']).default('list').optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  }),
});

export const ReceiptIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Receipt ID must be a numeric string'),
  }),
});

export type CreateReceiptInput = z.infer<typeof CreateReceiptSchema>['body'];
export type UpdateReceiptInput = z.infer<typeof UpdateReceiptSchema>['body'];
export type GetReceiptsQuery = z.infer<typeof GetReceiptsQuerySchema>['query'];
