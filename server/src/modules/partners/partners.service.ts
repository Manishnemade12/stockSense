import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import {
  CreatePartnerInput,
  UpdatePartnerInput,
  GetPartnersQuery,
} from './partners.schema.js';

export class PartnerService {
  /**
   * Create a partner (Supplier or Customer)
   */
  static async create(dto: CreatePartnerInput) {
    return await prisma.partner.create({
      data: {
        name: dto.name,
        type: dto.type,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        is_active: true,
      },
    });
  }

  /**
   * Get all active partners with optional type filter and search
   */
  static async getAll(query: GetPartnersQuery) {
    const { page, limit, type, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PartnerWhereInput = {
      is_active: true,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.partner.count({ where }),
      prisma.partner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
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
   * Get partner by ID
   */
  static async getById(id: bigint) {
    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw Errors.notFound(`Partner with ID ${id} not found`);
    }

    return partner;
  }

  /**
   * Update partner details
   */
  static async update(id: bigint, dto: UpdatePartnerInput) {
    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw Errors.notFound(`Partner with ID ${id} not found`);
    }

    return await prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
  }

  /**
   * Soft delete partner if not referenced by active operations
   */
  static async softDelete(id: bigint) {
    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw Errors.notFound(`Partner with ID ${id} not found`);
    }

    const activeOpsCount = await prisma.stockOperation.count({
      where: {
        partner_id: id,
        status: { not: 'CANCELED' },
      },
    });

    if (activeOpsCount > 0) {
      throw Errors.conflict(
        'Cannot delete partner referenced by active or completed operations'
      );
    }

    await prisma.partner.update({
      where: { id },
      data: { is_active: false },
    });

    return { message: 'Partner soft-deleted successfully' };
  }
}
