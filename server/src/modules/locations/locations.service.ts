import { LocationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import {
  CreateLocationInput,
  UpdateLocationInput,
  GetLocationsQuery,
} from './locations.schema.js';

export class LocationService {
  /**
   * Create an INTERNAL location for a warehouse
   */
  static async create(dto: CreateLocationInput) {
    // 1. Block creation of system virtual locations
    if (dto.location_type !== LocationType.INTERNAL) {
      throw Errors.badRequest(
        `Cannot manually create location of type "${dto.location_type}". Only INTERNAL locations can be created.`
      );
    }

    const warehouseId = BigInt(dto.warehouse_id);

    // 2. Verify warehouse exists and is active
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || !warehouse.is_active) {
      throw Errors.notFound(`Warehouse with ID ${dto.warehouse_id} not found or inactive`);
    }

    // 3. Verify parent location if provided
    let parentLocationId: bigint | null = null;
    if (dto.parent_location_id) {
      parentLocationId = BigInt(dto.parent_location_id);
      const parent = await prisma.location.findUnique({
        where: { id: parentLocationId },
      });
      if (!parent || !parent.is_active) {
        throw Errors.notFound(`Parent location with ID ${dto.parent_location_id} not found or inactive`);
      }
      if (parent.warehouse_id !== warehouseId) {
        throw Errors.badRequest('Parent location must belong to the same warehouse');
      }
    }

    // 4. Check uniqueness of code within warehouse
    const existingCode = await prisma.location.findFirst({
      where: {
        warehouse_id: warehouseId,
        code: dto.code,
        is_active: true,
      },
    });
    if (existingCode) {
      throw Errors.conflict(
        `Location with code "${dto.code}" already exists in warehouse "${warehouse.name}"`
      );
    }

    return await prisma.location.create({
      data: {
        name: dto.name,
        code: dto.code,
        location_type: LocationType.INTERNAL,
        warehouse_id: warehouseId,
        parent_location_id: parentLocationId,
        is_active: true,
      },
      include: {
        warehouse: true,
        parent_location: true,
      },
    });
  }

  /**
   * Get all active locations with optional warehouse_id and location_type filter
   */
  static async getAll(query: GetLocationsQuery) {
    const { page, limit, warehouse_id, location_type, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LocationWhereInput = {
      is_active: true,
      ...(warehouse_id ? { warehouse_id: BigInt(warehouse_id) } : {}),
      ...(location_type ? { location_type } : {}),
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
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          warehouse: true,
          parent_location: true,
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
   * Get a location by ID
   */
  static async getById(id: bigint) {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        warehouse: true,
        parent_location: true,
        child_locations: {
          where: { is_active: true },
        },
      },
    });

    if (!location) {
      throw Errors.notFound(`Location with ID ${id} not found`);
    }

    return location;
  }

  /**
   * Update location details
   */
  static async update(id: bigint, dto: UpdateLocationInput) {
    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw Errors.notFound(`Location with ID ${id} not found`);
    }

    // Check code clash if code changed
    if (dto.code && dto.code !== location.code) {
      const existing = await prisma.location.findFirst({
        where: {
          warehouse_id: location.warehouse_id,
          code: dto.code,
          id: { not: id },
          is_active: true,
        },
      });
      if (existing) {
        throw Errors.conflict(`Location with code "${dto.code}" already exists in this warehouse`);
      }
    }

    // Verify parent location if provided
    let parentLocationId: bigint | null | undefined = undefined;
    if (dto.parent_location_id !== undefined) {
      if (dto.parent_location_id === null) {
        parentLocationId = null;
      } else {
        const pId = BigInt(dto.parent_location_id);
        if (pId === id) {
          throw Errors.badRequest('Location cannot be its own parent');
        }
        const parent = await prisma.location.findUnique({
          where: { id: pId },
        });
        if (!parent || !parent.is_active) {
          throw Errors.notFound(`Parent location with ID ${dto.parent_location_id} not found or inactive`);
        }
        if (parent.warehouse_id !== location.warehouse_id) {
          throw Errors.badRequest('Parent location must belong to the same warehouse');
        }
        parentLocationId = pId;
      }
    }

    return await prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(parentLocationId !== undefined ? { parent_location_id: parentLocationId } : {}),
      },
      include: {
        warehouse: true,
        parent_location: true,
      },
    });
  }

  /**
   * Soft delete location
   */
  static async softDelete(id: bigint) {
    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw Errors.notFound(`Location with ID ${id} not found`);
    }

    if (location.location_type !== LocationType.INTERNAL) {
      throw Errors.badRequest('System virtual locations cannot be deleted');
    }

    // 1. Check operations references
    const activeOpsCount = await prisma.stockOperation.count({
      where: {
        OR: [{ source_location_id: id }, { destination_location_id: id }],
        status: { not: 'CANCELED' },
      },
    });

    if (activeOpsCount > 0) {
      throw Errors.conflict(
        'Cannot delete location referenced by active or completed operations'
      );
    }

    // 2. Check stock balance
    const positiveStockCount = await prisma.stockQuant.count({
      where: {
        location_id: id,
        quantity: { gt: 0 },
      },
    });

    if (positiveStockCount > 0) {
      throw Errors.conflict('Cannot delete location with positive stock balance');
    }

    // 3. Check child locations
    const childLocationsCount = await prisma.location.count({
      where: {
        parent_location_id: id,
        is_active: true,
      },
    });

    if (childLocationsCount > 0) {
      throw Errors.conflict('Cannot delete location that has active sub-locations');
    }

    await prisma.location.update({
      where: { id },
      data: { is_active: false },
    });

    return { message: 'Location soft-deleted successfully' };
  }
}
