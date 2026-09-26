import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  GetCategoriesQuery,
} from './categories.schema.js';

export class CategoryService {
  /**
   * Create a product category
   */
  static async create(dto: CreateCategoryInput) {
    let parentCategoryId: bigint | null = null;
    if (dto.parent_category_id) {
      parentCategoryId = BigInt(dto.parent_category_id);
      const parent = await prisma.productCategory.findUnique({
        where: { id: parentCategoryId },
      });
      if (!parent) {
        throw Errors.notFound(`Parent category with ID ${dto.parent_category_id} not found`);
      }
    }

    // Check duplicate name within the same parent
    const existing = await prisma.productCategory.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        parent_category_id: parentCategoryId,
      },
    });
    if (existing) {
      throw Errors.conflict(`Category with name "${dto.name}" already exists under this parent`);
    }

    return await prisma.productCategory.create({
      data: {
        name: dto.name,
        parent_category_id: parentCategoryId,
      },
      include: {
        parent_category: true,
      },
    });
  }

  /**
   * Get all categories with pagination & search
   */
  static async getAll(query: GetCategoriesQuery) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductCategoryWhereInput = search
      ? {
          name: { contains: search, mode: 'insensitive' },
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.productCategory.count({ where }),
      prisma.productCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          parent_category: true,
          _count: {
            select: {
              products: { where: { is_active: true } },
              child_categories: true,
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
   * Get category by ID
   */
  static async getById(id: bigint) {
    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        parent_category: true,
        child_categories: true,
        _count: {
          select: {
            products: { where: { is_active: true } },
          },
        },
      },
    });

    if (!category) {
      throw Errors.notFound(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Update category
   */
  static async update(id: bigint, dto: UpdateCategoryInput) {
    const category = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw Errors.notFound(`Category with ID ${id} not found`);
    }

    let parentCategoryId: bigint | null | undefined = undefined;
    if (dto.parent_category_id !== undefined) {
      if (dto.parent_category_id === null) {
        parentCategoryId = null;
      } else {
        const pId = BigInt(dto.parent_category_id);
        if (pId === id) {
          throw Errors.badRequest('Category cannot be its own parent');
        }
        const parent = await prisma.productCategory.findUnique({
          where: { id: pId },
        });
        if (!parent) {
          throw Errors.notFound(`Parent category with ID ${dto.parent_category_id} not found`);
        }
        parentCategoryId = pId;
      }
    }

    return await prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(parentCategoryId !== undefined ? { parent_category_id: parentCategoryId } : {}),
      },
      include: {
        parent_category: true,
      },
    });
  }

  /**
   * Delete category if no active products or subcategories reference it
   */
  static async delete(id: bigint) {
    const category = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw Errors.notFound(`Category with ID ${id} not found`);
    }

    // 1. Check active products
    const productCount = await prisma.product.count({
      where: {
        category_id: id,
        is_active: true,
      },
    });

    if (productCount > 0) {
      throw Errors.conflict(
        `Cannot delete category referenced by ${productCount} active product(s)`
      );
    }

    // 2. Check subcategories
    const childCount = await prisma.productCategory.count({
      where: {
        parent_category_id: id,
      },
    });

    if (childCount > 0) {
      throw Errors.conflict(
        `Cannot delete category that has ${childCount} subcategory/subcategories`
      );
    }

    await prisma.productCategory.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }
}
