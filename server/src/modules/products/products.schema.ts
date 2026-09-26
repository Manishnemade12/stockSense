import { z } from 'zod';

export const CreateProductSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: 'name is required' }).trim().min(1).max(150),
      sku: z.string({ required_error: 'sku is required' }).trim().min(1).max(60),
      barcode: z.string().trim().max(60).optional().nullable(),
      category_id: z.coerce.string().regex(/^\d+$/, 'category_id must be a numeric ID'),
      uom_id: z.coerce.string().regex(/^\d+$/, 'uom_id must be a numeric ID'),
      unit_cost: z.coerce.number().min(0, 'unit_cost cannot be negative').default(0),
      description: z.string().trim().optional().nullable(),
      reorder_min_qty: z.coerce.number().min(0, 'reorder_min_qty cannot be negative').default(0),
      reorder_max_qty: z.coerce.number().min(0, 'reorder_max_qty cannot be negative').optional().nullable(),
      initial_stock_quantity: z.coerce.number().min(0, 'initial_stock_quantity cannot be negative').optional(),
      initial_stock_location_id: z.coerce.string().regex(/^\d+$/).optional(),
    })
    .refine(
      (data) => {
        const hasQty = data.initial_stock_quantity !== undefined;
        const hasLoc = data.initial_stock_location_id !== undefined;
        return hasQty === hasLoc;
      },
      {
        message:
          'initial_stock_quantity and initial_stock_location_id must both be provided or both omitted',
        path: ['initial_stock_quantity'],
      }
    ),
});

export const UpdateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    barcode: z.string().trim().max(60).optional().nullable(),
    category_id: z.coerce.string().regex(/^\d+$/).optional(),
    uom_id: z.coerce.string().regex(/^\d+$/).optional(),
    unit_cost: z.coerce.number().min(0).optional(),
    description: z.string().trim().optional().nullable(),
    reorder_min_qty: z.coerce.number().min(0).optional(),
    reorder_max_qty: z.coerce.number().min(0).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
});

export const GetProductByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be numeric'),
  }),
});

export const GetProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category_id: z.coerce.string().regex(/^\d+$/).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const QuickUpdateStockSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Product ID must be numeric'),
    location_id: z.string().regex(/^\d+$/, 'Location ID must be numeric'),
  }),
  body: z.object({
    counted_quantity: z.coerce.number().min(0, 'counted_quantity cannot be negative'),
  }),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>['body'];
export type GetProductsQuery = z.infer<typeof GetProductsQuerySchema>['query'];
export type QuickUpdateStockInput = z.infer<typeof QuickUpdateStockSchema>['body'];
