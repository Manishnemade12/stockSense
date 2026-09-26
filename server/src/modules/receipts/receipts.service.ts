import {
  LocationType,
  OperationStatus,
  OperationType,
  PartnerType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { Errors } from '../../utils/errors.js';
import { ReferenceService } from '../operations/reference.service.js';
import { OperationService } from '../operations/operation.service.js';
import {
  CreateReceiptInput,
  UpdateReceiptInput,
  GetReceiptsQuery,
} from './receipts.schema.js';

export class ReceiptService {
  /**
   * Helper: Format a single receipt entity with lines and is_late
   */
  private static formatReceipt(op: any) {
    const now = new Date();
    const isLate =
      op.scheduled_date < now &&
      op.status !== OperationStatus.DONE &&
      op.status !== OperationStatus.CANCELED;

    return {
      id: op.id,
      reference_no: op.reference_no,
      operation_type: op.operation_type,
      status: op.status,
      warehouse_id: op.warehouse_id,
      warehouse: op.warehouse
        ? {
            id: op.warehouse.id,
            name: op.warehouse.name,
            code: op.warehouse.code,
          }
        : undefined,
      source_location_id: op.source_location_id,
      source_location: op.source_location
        ? {
            id: op.source_location.id,
            name: op.source_location.name,
            code: op.source_location.code,
            location_type: op.source_location.location_type,
          }
        : undefined,
      destination_location_id: op.destination_location_id,
      destination_location: op.destination_location
        ? {
            id: op.destination_location.id,
            name: op.destination_location.name,
            code: op.destination_location.code,
            location_type: op.destination_location.location_type,
          }
        : undefined,
      partner_id: op.partner_id,
      partner: op.partner
        ? {
            id: op.partner.id,
            name: op.partner.name,
            type: op.partner.type,
            email: op.partner.email,
            phone: op.partner.phone,
            address: op.partner.address,
          }
        : undefined,
      scheduled_date: op.scheduled_date,
      validated_date: op.validated_date,
      created_by: op.created_by,
      responsible_user_id: op.responsible_user_id,
      notes: op.notes,
      is_late: isLate,
      created_at: op.created_at,
      updated_at: op.updated_at,
      lines: op.lines
        ? op.lines.map((line: any) => ({
            id: line.id,
            product_id: line.product_id,
            product: line.product
              ? {
                  id: line.product.id,
                  name: line.product.name,
                  sku: line.product.sku,
                }
              : undefined,
            uom_id: line.uom_id,
            uom: line.uom
              ? {
                  id: line.uom.id,
                  name: line.uom.name,
                  code: line.uom.code,
                }
              : undefined,
            quantity_planned: Number(line.quantity_planned),
            quantity_done: Number(line.quantity_done),
            notes: line.notes,
            available_at_source: null,
            is_short: false,
          }))
        : undefined,
    };
  }

  /**
   * Create a new Receipt in DRAFT status
   */
  static async create(dto: CreateReceiptInput, userId: bigint) {
    const partnerId = BigInt(dto.partner_id);
    const warehouseId = BigInt(dto.warehouse_id);
    const destLocationId = BigInt(dto.destination_location_id);

    // 1. Verify Partner exists and is active
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || !partner.is_active) {
      throw Errors.notFound(`Partner with ID ${dto.partner_id} not found or inactive`);
    }

    // 2. Verify Warehouse exists and is active
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || !warehouse.is_active) {
      throw Errors.notFound(`Warehouse with ID ${dto.warehouse_id} not found or inactive`);
    }

    // 3. Verify Destination Location exists, is active, is INTERNAL, and belongs to warehouse
    const destLocation = await prisma.location.findUnique({
      where: { id: destLocationId },
    });
    if (!destLocation || !destLocation.is_active) {
      throw Errors.notFound(
        `Destination location with ID ${dto.destination_location_id} not found or inactive`
      );
    }
    if (destLocation.location_type !== LocationType.INTERNAL) {
      throw Errors.badRequest('Destination location must be of type INTERNAL');
    }
    if (destLocation.warehouse_id !== warehouseId) {
      throw Errors.badRequest(
        `Destination location does not belong to warehouse ${warehouse.name}`
      );
    }

    // 4. Verify products & UoMs for all lines
    for (const line of dto.lines) {
      const prodId = BigInt(line.product_id);
      const uomId = BigInt(line.uom_id);

      const prod = await prisma.product.findUnique({ where: { id: prodId } });
      if (!prod || !prod.is_active) {
        throw Errors.notFound(`Product with ID ${line.product_id} not found or inactive`);
      }

      const uom = await prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
      if (!uom) {
        throw Errors.notFound(`Unit of measure with ID ${line.uom_id} not found`);
      }
    }

    // 5. Find or create Vendor virtual location
    let vendorLocation = await prisma.location.findFirst({
      where: { location_type: LocationType.VENDOR },
    });
    if (!vendorLocation) {
      vendorLocation = await prisma.location.create({
        data: {
          name: 'Vendor',
          code: 'VENDOR',
          location_type: LocationType.VENDOR,
          warehouse_id: null,
        },
      });
    }

    // 6. Execute atomic creation inside transaction
    const createdOp = await prisma.$transaction(async (tx) => {
      const referenceNo = await ReferenceService.generate(
        tx,
        warehouse.code,
        OperationType.RECEIPT
      );

      return await tx.stockOperation.create({
        data: {
          reference_no: referenceNo,
          operation_type: OperationType.RECEIPT,
          status: OperationStatus.DRAFT,
          warehouse_id: warehouseId,
          source_location_id: vendorLocation.id,
          destination_location_id: destLocationId,
          partner_id: partnerId,
          scheduled_date: new Date(dto.scheduled_date),
          notes: dto.notes,
          created_by: userId,
          responsible_user_id: userId,
          lines: {
            create: dto.lines.map((line) => ({
              product_id: BigInt(line.product_id),
              uom_id: BigInt(line.uom_id),
              quantity_planned: new Prisma.Decimal(line.quantity_planned),
              quantity_done: new Prisma.Decimal(0),
            })),
          },
        },
        include: {
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
          warehouse: true,
          partner: true,
          source_location: true,
          destination_location: true,
        },
      });
    });

    return this.formatReceipt(createdOp);
  }

  /**
   * Get paginated list of receipts with filters
   */
  static async getAll(
    query: GetReceiptsQuery,
    user: { userId: bigint; role: UserRole; warehouseId: bigint | string | null }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StockOperationWhereInput = {
      operation_type: OperationType.RECEIPT,
    };

    // Scoping for WAREHOUSE_STAFF
    if (user.role === UserRole.WAREHOUSE_STAFF && user.warehouseId) {
      where.warehouse_id = BigInt(user.warehouseId);
    } else if (query.warehouse_id) {
      where.warehouse_id = BigInt(query.warehouse_id);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { reference_no: { contains: query.search, mode: 'insensitive' } },
        { partner: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, rawItems] = await Promise.all([
      prisma.stockOperation.count({ where }),
      prisma.stockOperation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          partner: true,
          warehouse: true,
          source_location: true,
          destination_location: true,
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
        },
      }),
    ]);

    const items = rawItems.map((item) => this.formatReceipt(item));

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
   * Get single receipt by ID with lines
   */
  static async getById(id: bigint) {
    const op = await prisma.stockOperation.findFirst({
      where: {
        id,
        operation_type: OperationType.RECEIPT,
      },
      include: {
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
        warehouse: true,
        partner: true,
        source_location: true,
        destination_location: true,
      },
    });

    if (!op) {
      throw Errors.notFound('Receipt not found');
    }

    return this.formatReceipt(op);
  }

  /**
   * Update receipt header / lines while not DONE/CANCELED
   */
  static async update(id: bigint, dto: UpdateReceiptInput, userId: bigint) {
    const existing = await prisma.stockOperation.findFirst({
      where: {
        id,
        operation_type: OperationType.RECEIPT,
      },
      include: { lines: true },
    });

    if (!existing) {
      throw Errors.notFound('Receipt not found');
    }

    OperationService.assertMutable(existing);

    const updated = await prisma.$transaction(async (tx) => {
      // If lines provided, handle updates or replacements
      if (dto.lines && dto.lines.length > 0) {
        if (existing.status === OperationStatus.DRAFT) {
          // In DRAFT, delete existing lines and re-create
          await tx.stockOperationLine.deleteMany({
            where: { operation_id: id },
          });

          await tx.stockOperationLine.createMany({
            data: dto.lines.map((line) => ({
              operation_id: id,
              product_id: BigInt(line.product_id),
              uom_id: BigInt(line.uom_id),
              quantity_planned: new Prisma.Decimal(line.quantity_planned),
              quantity_done: new Prisma.Decimal(line.quantity_done ?? 0),
            })),
          });
        } else {
          // In READY, update quantity_done on existing lines
          for (const line of dto.lines) {
            if (line.id) {
              await tx.stockOperationLine.update({
                where: { id: BigInt(line.id) },
                data: {
                  quantity_done:
                    line.quantity_done !== undefined
                      ? new Prisma.Decimal(line.quantity_done)
                      : undefined,
                  quantity_planned:
                    line.quantity_planned !== undefined
                      ? new Prisma.Decimal(line.quantity_planned)
                      : undefined,
                },
              });
            }
          }
        }
      }

      return await tx.stockOperation.update({
        where: { id },
        data: {
          responsible_user_id: dto.responsible_user_id
            ? BigInt(dto.responsible_user_id)
            : undefined,
          notes: dto.notes !== undefined ? dto.notes : undefined,
        },
        include: {
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
          warehouse: true,
          partner: true,
          source_location: true,
          destination_location: true,
        },
      });
    });

    return this.formatReceipt(updated);
  }

  /**
   * Confirm receipt: DRAFT -> READY
   */
  static async confirm(id: bigint, userId: bigint) {
    const existing = await prisma.stockOperation.findFirst({
      where: { id, operation_type: OperationType.RECEIPT },
    });
    if (!existing) {
      throw Errors.notFound('Receipt not found');
    }

    const result = await OperationService.confirm(id, userId);
    return this.getById(result.id);
  }

  /**
   * Validate receipt: READY -> DONE (stock incremented, ledger written)
   */
  static async validate(id: bigint, userId: bigint) {
    const existing = await prisma.stockOperation.findFirst({
      where: { id, operation_type: OperationType.RECEIPT },
    });
    if (!existing) {
      throw Errors.notFound('Receipt not found');
    }

    const result = await OperationService.validate(id, userId);
    return this.getById(result.id);
  }

  /**
   * Cancel receipt: !DONE -> CANCELED
   */
  static async cancel(id: bigint, userId: bigint, userRole?: UserRole) {
    const existing = await prisma.stockOperation.findFirst({
      where: { id, operation_type: OperationType.RECEIPT },
    });
    if (!existing) {
      throw Errors.notFound('Receipt not found');
    }

    const result = await OperationService.cancel(id, userId, userRole);
    return this.getById(result.id);
  }

  /**
   * Get printable slip data for DONE receipt
   */
  static async getPrintData(id: bigint) {
    const op = await prisma.stockOperation.findFirst({
      where: {
        id,
        operation_type: OperationType.RECEIPT,
      },
      include: {
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
        warehouse: true,
        partner: true,
        destination_location: true,
      },
    });

    if (!op) {
      throw Errors.notFound('Receipt not found');
    }

    if (op.status !== OperationStatus.DONE) {
      throw Errors.badRequest('Print slip is only available for DONE receipts');
    }

    return {
      reference_no: op.reference_no,
      operation_type: 'RECEIPT',
      status: 'DONE',
      partner: op.partner
        ? {
            name: op.partner.name,
            address: op.partner.address,
            phone: op.partner.phone,
          }
        : null,
      warehouse: op.warehouse
        ? {
            name: op.warehouse.name,
            code: op.warehouse.code,
          }
        : null,
      destination_location: op.destination_location
        ? {
            name: op.destination_location.name,
            code: op.destination_location.code,
          }
        : null,
      scheduled_date: op.scheduled_date,
      validated_date: op.validated_date,
      lines: op.lines.map((line) => ({
        product_name: line.product?.name,
        sku: line.product?.sku,
        uom_code: line.uom?.code,
        quantity_planned: Number(line.quantity_planned),
        quantity_done: Number(line.quantity_done),
      })),
    };
  }
}
