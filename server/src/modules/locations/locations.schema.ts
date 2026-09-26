import { z } from 'zod';
import { LocationType } from '@prisma/client';

export const CreateLocationSchema = z.object({
  body: z.object({
    warehouse_id: z.coerce.string().regex(/^\d+$/, 'warehouse_id must be a numeric ID'),
    parent_location_id: z.coerce.string().regex(/^\d+$/).optional().nullable(),
    name: z.string({ required_error: 'name is required' }).trim().min(1).max(120),
    code: z.string({ required_error: 'code is required' }).trim().min(1).max(30).toUpperCase(),
    location_type: z.nativeEnum(LocationType, {
      errorMap: () => ({ message: 'Invalid location_type' }),
    }),
  }),
});

export const UpdateLocationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(30).toUpperCase().optional(),
    parent_location_id: z.coerce.string().regex(/^\d+$/).optional().nullable(),
  }),
});

export const GetLocationByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetLocationsQuerySchema = z.object({
  query: z.object({
    warehouse_id: z.coerce.string().regex(/^\d+$/).optional(),
    location_type: z.nativeEnum(LocationType).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>['body'];
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>['body'];
export type GetLocationsQuery = z.infer<typeof GetLocationsQuerySchema>['query'];
