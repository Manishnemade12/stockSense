import { LocationType, OperationType, OperationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import { StockService } from '../operations/stock.service.js';
import { ReferenceService } from '../operations/reference.service.js';
import {
  CreateProductInput,
  UpdateProductInput,
  GetProductsQuery,
} from './products.schema.js';

export class ProductService {
  /**
   * Create a product with optional initial opening stock
   */
  static async create(dto: CreateProductInput, userId: bigint) {
    // 1. Check SKU uniqueness
    const existingSku = await prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existingSku) {
      throw Errors.conflict(`Product with SKU "${dto.sku}" already exists`);
    }

    const categoryId = BigInt(dto.category_id);
    const uomId = BigInt(dto.uom_id);

    // 2. Verify category exists
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw Errors.notFound(`Category with ID ${dto.category_id} not found`);
    }

    // 3. Verify UoM exists
    const uom = await prisma.unitOfMeasure.findUnique({
      where: { id: uomId },
    });
    if (!uom) {
      throw Errors.notFound(`Unit of measure with ID ${dto.uom_id} not found`);
    }

    // 4. Validate initial stock location if specified
    let locationRecord: any = null;
    if (dto.initial_stock_location_id) {
      const locId = BigInt(dto.initial_stock_location_id);
      locationRecord = await prisma.location.findUnique({
        where: { id: locId },
        include: { warehouse: true },
      });
      if (!locationRecord || !locationRecord.is_active) {
        throw Errors.notFound(
          `Initial stock location with ID ${dto.initial_stock_location_id} not found or inactive`
        );
      }
      if (locationRecord.location_type !== LocationType.INTERNAL) {
        throw Errors.badRequest('Initial stock location must be of type INTERNAL');
      }
      if (!locationRecord.warehouse_id) {
        throw Errors.badRequest('Initial stock location must belong to a warehouse');
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 5. Create product record
      const product = await tx.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
          category_id: categoryId,
          uom_id: uomId,
          unit_cost: dto.unit_cost !== undefined ? new Prisma.Decimal(dto.unit_cost) : new Prisma.Decimal(0),
          description: dto.description,
          reorder_min_qty:
            dto.reorder_min_qty !== undefined ? new Prisma.Decimal(dto.reorder_min_qty) : new Prisma.Decimal(0),
          reorder_max_qty:
            dto.reorder_max_qty !== undefined && dto.reorder_max_qty !== null
              ? new Prisma.Decimal(dto.reorder_max_qty)
              : null,
          is_active: true,
        },
        include: {
          category: true,
          uom: true,
        },
      });

      // 6. Handle initial stock if given
      if (
        dto.initial_stock_quantity !== undefined &&
        dto.initial_stock_location_id !== undefined &&
        locationRecord
      ) {
        const initialQty = new Prisma.Decimal(dto.initial_stock_quantity);
        const locationId = locationRecord.id;
        const warehouseId = locationRecord.warehouse_id!;
        const warehouseCode = locationRecord.warehouse?.code || 'WH';

        // Mutate stock quant via StockService
        await StockService.increment(tx, product.id, locationId, initialQty);

        if (dto.initial_stock_quantity > 0) {
          const referenceNo = await ReferenceService.generate(
            tx,
            warehouseCode,
            OperationType.ADJUSTMENT
          );

          const now = new Date();

          // Create stock operation
          const operation = await tx.stockOperation.create({
            data: {
              reference_no: referenceNo,
              operation_type: OperationType.ADJUSTMENT,
              status: OperationStatus.DONE,
              warehouse_id: warehouseId,
              scheduled_date: now,
              validated_date: now,
              created_by: userId,
              responsible_user_id: userId,
              notes: 'Initial opening stock upon product creation',
            },
          });

          // Create adjustment line
          await tx.stockAdjustmentLine.create({
            data: {
              operation_id: operation.id,
              product_id: product.id,
              location_id: locationId,
              uom_id: uomId,
              recorded_quantity: new Prisma.Decimal(0),
              counted_quantity: initialQty,
              difference: initialQty,
            },
          });

          // Create stock ledger entry
          await tx.stockLedgerEntry.create({
            data: {
              product_id: product.id,
              location_id: locationId,
              quantity_change: initialQty,
              balance_after: initialQty,
              operation_id: operation.id,
              operation_type: OperationType.ADJUSTMENT,
              reference_no: referenceNo,
              movement_date: now,
              created_by: userId,
            },
          });
        }
      }

      return product;
    });
  }

  /**
   * Get all active products with pagination, category filter & search
   */
  static async getAll(query: GetProductsQuery) {
    const { page, limit, category_id, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      is_active: true,
      ...(category_id ? { category_id: BigInt(category_id) } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          category: true,
          uom: true,
        },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Get product by ID
   */
  static async getById(id: bigint) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        uom: true,
      },
    });

    if (!product) {
      throw Errors.notFound(`Product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Update product (SKU is immutable)
   */
  static async update(id: bigint, dto: UpdateProductInput) {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw Errors.notFound(`Product with ID ${id} not found`);
    }

    let categoryId: bigint | undefined = undefined;
    if (dto.category_id !== undefined) {
      categoryId = BigInt(dto.category_id);
      const cat = await prisma.productCategory.findUnique({
        where: { id: categoryId },
      });
      if (!cat) {
        throw Errors.notFound(`Category with ID ${dto.category_id} not found`);
      }
    }

    let uomId: bigint | undefined = undefined;
    if (dto.uom_id !== undefined) {
      uomId = BigInt(dto.uom_id);
      const u = await prisma.unitOfMeasure.findUnique({
        where: { id: uomId },
      });
      if (!u) {
        throw Errors.notFound(`Unit of measure with ID ${dto.uom_id} not found`);
      }
    }

    return await prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(categoryId !== undefined ? { category_id: categoryId } : {}),
        ...(uomId !== undefined ? { uom_id: uomId } : {}),
        ...(dto.unit_cost !== undefined ? { unit_cost: new Prisma.Decimal(dto.unit_cost) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.reorder_min_qty !== undefined
          ? { reorder_min_qty: new Prisma.Decimal(dto.reorder_min_qty) }
          : {}),
        ...(dto.reorder_max_qty !== undefined
          ? {
              reorder_max_qty:
                dto.reorder_max_qty !== null ? new Prisma.Decimal(dto.reorder_max_qty) : null,
            }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
      include: {
        category: true,
        uom: true,
      },
    });
  }

  /**
   * Soft delete product
   */
  static async softDelete(id: bigint) {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw Errors.notFound(`Product with ID ${id} not found`);
    }

    // 1. Check operation lines
    const activeOpLinesCount = await prisma.stockOperationLine.count({
      where: {
        product_id: id,
        operation: {
          status: { not: OperationStatus.CANCELED },
        },
      },
    });

    if (activeOpLinesCount > 0) {
      throw Errors.conflict(
        'Cannot delete product referenced by active or completed operations'
      );
    }

    // 2. Check adjustment lines
    const activeAdjLinesCount = await prisma.stockAdjustmentLine.count({
      where: {
        product_id: id,
        operation: {
          status: { not: OperationStatus.CANCELED },
        },
      },
    });

    if (activeAdjLinesCount > 0) {
      throw Errors.conflict(
        'Cannot delete product referenced by active or completed stock adjustments'
      );
    }

    // 3. Check positive stock
    const positiveStockCount = await prisma.stockQuant.count({
      where: {
        product_id: id,
        quantity: { gt: 0 },
      },
    });

    if (positiveStockCount > 0) {
      throw Errors.conflict('Cannot delete product with positive on-hand stock balance');
    }

    await prisma.product.update({
      where: { id },
      data: { is_active: false },
    });

    return { message: 'Product soft-deleted successfully' };
  }

  /**
   * Get per-location stock breakdown for a product with computed free_to_use
   */
  static async getProductStock(productId: bigint) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw Errors.notFound(`Product with ID ${productId} not found`);
    }

    const quants = await prisma.stockQuant.findMany({
      where: {
        product_id: productId,
        location: { is_active: true },
      },
      include: {
        location: true,
      },
    });

    return quants.map((q) => {
      const qty = Number(q.quantity);
      const reserved = Number(q.reserved_quantity);
      return {
        location_id: q.location_id,
        location_name: q.location.name,
        location_code: q.location.code,
        unit_cost: Number(product.unit_cost),
        on_hand: qty,
        reserved_quantity: reserved,
        free_to_use: qty - reserved,
      };
    });
  }

  /**
   * Quick stock update for a product at a specific location
   */
  static async quickUpdateStock(
    productId: bigint,
    locationId: bigint,
    countedQuantity: number,
    userId: bigint
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || !product.is_active) {
      throw Errors.notFound(`Product with ID ${productId} not found or inactive`);
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: { warehouse: true },
    });
    if (!location || !location.is_active) {
      throw Errors.notFound(`Location with ID ${locationId} not found or inactive`);
    }
    if (location.location_type !== LocationType.INTERNAL || !location.warehouse_id) {
      throw Errors.badRequest('Stock can only be updated for active INTERNAL locations');
    }

    return await prisma.$transaction(async (tx) => {
      const currentQuant = await StockService.getOrCreate(tx, productId, locationId);

      const recordedQty = currentQuant.quantity;
      const newCountedQty = new Prisma.Decimal(countedQuantity);
      const difference = newCountedQty.minus(recordedQty);
      const reservedQty = currentQuant.reserved_quantity;

      // Update quant using StockService logic
      if (difference.greaterThan(0)) {
        await StockService.increment(tx, productId, locationId, difference);
      } else if (difference.lessThan(0)) {
        await StockService.decrement(tx, productId, locationId, difference.abs());
      }

      if (!difference.isZero()) {
        const warehouseCode = location.warehouse?.code || 'WH';
        const referenceNo = await ReferenceService.generate(
          tx,
          warehouseCode,
          OperationType.ADJUSTMENT
        );
        const now = new Date();

        const operation = await tx.stockOperation.create({
          data: {
            reference_no: referenceNo,
            operation_type: OperationType.ADJUSTMENT,
            status: OperationStatus.DONE,
            warehouse_id: location.warehouse_id!,
            scheduled_date: now,
            validated_date: now,
            created_by: userId,
            responsible_user_id: userId,
            notes: 'Inline stock quick update',
          },
        });

        await tx.stockAdjustmentLine.create({
          data: {
            operation_id: operation.id,
            product_id: productId,
            location_id: locationId,
            uom_id: product.uom_id,
            recorded_quantity: recordedQty,
            counted_quantity: newCountedQty,
            difference: difference,
          },
        });

        await tx.stockLedgerEntry.create({
          data: {
            product_id: productId,
            location_id: locationId,
            quantity_change: difference,
            balance_after: newCountedQty,
            operation_id: operation.id,
            operation_type: OperationType.ADJUSTMENT,
            reference_no: referenceNo,
            movement_date: now,
            created_by: userId,
          },
        });
      }

      return {
        on_hand: Number(newCountedQty),
        free_to_use: Number(newCountedQty) - Number(reservedQty),
      };
    });
  }
}
