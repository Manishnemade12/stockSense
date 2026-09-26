import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import {
  CreateUomInput,
  UpdateUomInput,
  GetUomQuery,
} from './uom.schema.js';

export class UomService {
  /**
   * Create a unit of measure
   */
  static async create(dto: CreateUomInput) {
    const existing = await prisma.unitOfMeasure.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw Errors.conflict(`Unit of measure with code "${dto.code}" already exists`);
    }

    return await prisma.unitOfMeasure.create({
      data: {
        name: dto.name,
        code: dto.code,
      },
    });
  }

  /**
   * Get all units of measure
   */
  static async getAll(query: GetUomQuery) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UnitOfMeasureWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.unitOfMeasure.count({ where }),
      prisma.unitOfMeasure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          _count: {
            select: {
              products: { where: { is_active: true } },
            },
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
   * Get UoM by ID
   */
  static async getById(id: bigint) {
    const uom = await prisma.unitOfMeasure.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: { where: { is_active: true } },
          },
        },
      },
    });

    if (!uom) {
      throw Errors.notFound(`Unit of measure with ID ${id} not found`);
    }

    return uom;
  }

  /**
   * Update UoM
   */
  static async update(id: bigint, dto: UpdateUomInput) {
    const uom = await prisma.unitOfMeasure.findUnique({
      where: { id },
    });

    if (!uom) {
      throw Errors.notFound(`Unit of measure with ID ${id} not found`);
    }

    if (dto.code && dto.code !== uom.code) {
      const clash = await prisma.unitOfMeasure.findUnique({
        where: { code: dto.code },
      });
      if (clash) {
        throw Errors.conflict(`Unit of measure with code "${dto.code}" already exists`);
      }
    }

    return await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
      },
    });
  }

  /**
   * Delete UoM if not referenced by products or operation lines
   */
  static async delete(id: bigint) {
    const uom = await prisma.unitOfMeasure.findUnique({
      where: { id },
    });

    if (!uom) {
      throw Errors.notFound(`Unit of measure with ID ${id} not found`);
    }

    // 1. Check products
    const productCount = await prisma.product.count({
      where: {
        uom_id: id,
        is_active: true,
      },
    });

    if (productCount > 0) {
      throw Errors.conflict(
        `Cannot delete unit of measure referenced by ${productCount} active product(s)`
      );
    }

    // 2. Check operation lines
    const lineCount = await prisma.stockOperationLine.count({
      where: { uom_id: id },
    });

    if (lineCount > 0) {
      throw Errors.conflict('Cannot delete unit of measure referenced by stock operation lines');
    }

    const adjLineCount = await prisma.stockAdjustmentLine.count({
      where: { uom_id: id },
    });

    if (adjLineCount > 0) {
      throw Errors.conflict('Cannot delete unit of measure referenced by stock adjustment lines');
    }

    await prisma.unitOfMeasure.delete({
      where: { id },
    });

    return { message: 'Unit of measure deleted successfully' };
  }
}
