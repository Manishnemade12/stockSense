import { LocationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  GetWarehousesQuery,
} from './warehouses.schema.js';

export class WarehouseService {
  /**
   * Create warehouse and atomically seed a default INTERNAL location (Stock / STOCK)
   */
  static async create(dto: CreateWarehouseInput) {
    const existing = await prisma.warehouse.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw Errors.conflict(`Warehouse with code "${dto.code}" already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          is_active: true,
        },
      });

      const defaultLocation = await tx.location.create({
        data: {
          name: 'Stock',
          code: 'STOCK',
          location_type: LocationType.INTERNAL,
          warehouse_id: warehouse.id,
          is_active: true,
        },
      });

      return {
        ...warehouse,
        locations: [defaultLocation],
      };
    });
  }

  /**
   * Get all active warehouses with pagination & search
   */
  static async getAll(query: GetWarehousesQuery) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {
      is_active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          locations: {
            where: { is_active: true },
          },
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
   * Get a single warehouse by ID
   */
  static async getById(id: bigint) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        locations: {
          where: { is_active: true },
        },
      },
    });

    if (!warehouse) {
      throw Errors.notFound(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  /**
   * Update warehouse details
   */
  static async update(id: bigint, dto: UpdateWarehouseInput) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw Errors.notFound(`Warehouse with ID ${id} not found`);
    }

    if (dto.code && dto.code !== warehouse.code) {
      const codeClash = await prisma.warehouse.findUnique({
        where: { code: dto.code },
      });
      if (codeClash) {
        throw Errors.conflict(`Warehouse with code "${dto.code}" already exists`);
      }
    }

    return await prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
      include: {
        locations: {
          where: { is_active: true },
        },
      },
    });
  }

  /**
   * Soft delete warehouse if not referenced by active operations or positive stock
   */
  static async softDelete(id: bigint) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw Errors.notFound(`Warehouse with ID ${id} not found`);
    }

    // 1. Check non-canceled operations
    const activeOpsCount = await prisma.stockOperation.count({
      where: {
        warehouse_id: id,
        status: { not: 'CANCELED' },
      },
    });

    if (activeOpsCount > 0) {
      throw Errors.conflict(
        'Cannot delete warehouse referenced by active or completed operations'
      );
    }

    // 2. Check positive stock in locations
    const positiveStockCount = await prisma.stockQuant.count({
      where: {
        location: { warehouse_id: id },
        quantity: { gt: 0 },
      },
    });

    if (positiveStockCount > 0) {
      throw Errors.conflict('Cannot delete warehouse with positive stock balance');
    }

    // Soft delete warehouse and its locations
    await prisma.$transaction([
      prisma.location.updateMany({
        where: { warehouse_id: id },
        data: { is_active: false },
      }),
      prisma.warehouse.update({
        where: { id },
        data: { is_active: false },
      }),
    ]);

    return { message: 'Warehouse soft-deleted successfully' };
  }
}
