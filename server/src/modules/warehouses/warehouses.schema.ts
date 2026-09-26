import { z } from 'zod';

export const CreateWarehouseSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'name is required' }).trim().min(1).max(120),
    code: z
      .string({ required_error: 'code is required' })
      .trim()
      .min(1)
      .max(20)
      .toUpperCase(),
    address: z.string().trim().optional().nullable(),
  }),
});

export const UpdateWarehouseSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(20).toUpperCase().optional(),
    address: z.string().trim().optional().nullable(),
  }),
});

export const GetWarehouseByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetWarehousesQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>['body'];
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>['body'];
export type GetWarehousesQuery = z.infer<typeof GetWarehousesQuerySchema>['query'];
