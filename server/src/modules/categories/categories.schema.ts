import { z } from 'zod';

export const CreateCategorySchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'name is required' }).trim().min(1).max(100),
    parent_category_id: z.coerce.string().regex(/^\d+$/).optional().nullable(),
  }),
});

export const UpdateCategorySchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    parent_category_id: z.coerce.string().regex(/^\d+$/).optional().nullable(),
  }),
});

export const GetCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetCategoriesQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>['body'];
export type GetCategoriesQuery = z.infer<typeof GetCategoriesQuerySchema>['query'];
