import { z } from 'zod';

export const CreateUomSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'name is required' }).trim().min(1).max(40),
    code: z
      .string({ required_error: 'code is required' })
      .trim()
      .min(1)
      .max(10)
      .toLowerCase(),
  }),
});

export const UpdateUomSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(40).optional(),
    code: z.string().trim().min(1).max(10).toLowerCase().optional(),
  }),
});

export const GetUomByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetUomQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type CreateUomInput = z.infer<typeof CreateUomSchema>['body'];
export type UpdateUomInput = z.infer<typeof UpdateUomSchema>['body'];
export type GetUomQuery = z.infer<typeof GetUomQuerySchema>['query'];
