import { z } from 'zod';
import { OperationType, OperationStatus } from '@prisma/client';

export const CreateOperationLineSchema = z.object({
  product_id: z.coerce.number().positive(),
  uom_id: z.coerce.number().positive().optional(),
  location_id: z.coerce.number().positive().optional(),
  quantity_planned: z.coerce.number().nonnegative().optional().default(1),
  quantity_done: z.coerce.number().nonnegative().optional().default(0),
  counted_quantity: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(255).optional(),
});

export const CreateOperationSchema = z.object({
  body: z.object({
    operation_type: z.nativeEnum(OperationType),
    warehouse_id: z.coerce.number().positive(),
    partner_id: z.coerce.number().positive().nullable().optional(),
    source_location_id: z.coerce.number().positive().nullable().optional(),
    destination_location_id: z.coerce.number().positive().nullable().optional(),
    responsible_user_id: z.coerce.number().positive().nullable().optional(),
    scheduled_date: z.string().datetime().optional().or(z.date()).optional(),
    notes: z.string().max(500).optional(),
    lines: z.array(CreateOperationLineSchema).min(1, 'At least one operation line is required'),
  }),
});

export const UpdateOperationLineSchema = z.object({
  id: z.coerce.number().positive().optional(),
  product_id: z.coerce.number().positive(),
  uom_id: z.coerce.number().positive().optional(),
  location_id: z.coerce.number().positive().optional(),
  quantity_planned: z.coerce.number().nonnegative().optional(),
  quantity_done: z.coerce.number().nonnegative().optional(),
  counted_quantity: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(255).optional(),
});

export const UpdateOperationSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive(),
  }),
  body: z.object({
    partner_id: z.coerce.number().positive().nullable().optional(),
    source_location_id: z.coerce.number().positive().nullable().optional(),
    destination_location_id: z.coerce.number().positive().nullable().optional(),
    responsible_user_id: z.coerce.number().positive().nullable().optional(),
    scheduled_date: z.string().datetime().optional().or(z.date()).optional(),
    notes: z.string().max(500).optional(),
    lines: z.array(UpdateOperationLineSchema).optional(),
  }),
});

export const GetOperationsQuerySchema = z.object({
  query: z.object({
    type: z.nativeEnum(OperationType).optional(),
    operation_type: z.nativeEnum(OperationType).optional(),
    status: z.nativeEnum(OperationStatus).or(z.literal('ALL')).optional(),
    warehouse_id: z.coerce.number().positive().optional(),
    search: z.string().optional(),
    page: z.coerce.number().positive().optional().default(1),
    limit: z.coerce.number().positive().max(100).optional().default(20),
  }),
});

export const OperationIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().positive(),
  }),
});

export type CreateOperationInput = z.infer<typeof CreateOperationSchema>['body'];
export type UpdateOperationInput = z.infer<typeof UpdateOperationSchema>['body'];
export type GetOperationsQuery = z.infer<typeof GetOperationsQuerySchema>['query'];
