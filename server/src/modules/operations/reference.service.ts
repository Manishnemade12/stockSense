import { OperationType, Prisma } from '@prisma/client';

export class ReferenceService {
  private static readonly OP_CODES: Record<OperationType, string> = {
    RECEIPT: 'IN',
    DELIVERY: 'OUT',
    INTERNAL_TRANSFER: 'INT',
    ADJUSTMENT: 'ADJ',
  };

  /**
   * Generates formatted reference numbers like WH1/IN/0001
   * Must be called inside a Prisma transaction context.
   */
  static async generate(
    tx: Prisma.TransactionClient,
    warehouseCode: string,
    opType: OperationType
  ): Promise<string> {
    const opCode = this.OP_CODES[opType];
    const prefix = `${warehouseCode}/${opCode}/`;

    const last = await tx.stockOperation.findFirst({
      where: { reference_no: { startsWith: prefix } },
      orderBy: { reference_no: 'desc' },
      select: { reference_no: true },
    });

    let sequence = 1;
    if (last) {
      const lastSeq = parseInt(last.reference_no.split('/').pop() ?? '0', 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}
