import { z } from 'zod';
import { PartnerType } from '@prisma/client';

export const CreatePartnerSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'name is required' }).trim().min(1).max(150),
    type: z.nativeEnum(PartnerType, {
      errorMap: () => ({ message: 'type must be SUPPLIER or CUSTOMER' }),
    }),
    email: z.string().trim().email('Invalid email address').max(160).optional().nullable(),
    phone: z.string().trim().max(20).optional().nullable(),
    address: z.string().trim().optional().nullable(),
  }),
});

export const UpdatePartnerSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    type: z.nativeEnum(PartnerType).optional(),
    email: z.string().trim().email('Invalid email address').max(160).optional().nullable(),
    phone: z.string().trim().max(20).optional().nullable(),
    address: z.string().trim().optional().nullable(),
  }),
});

export const GetPartnerByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetPartnersQuerySchema = z.object({
  query: z.object({
    type: z.nativeEnum(PartnerType).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>['body'];
export type UpdatePartnerInput = z.infer<typeof UpdatePartnerSchema>['body'];
export type GetPartnersQuery = z.infer<typeof GetPartnersQuerySchema>['query'];
