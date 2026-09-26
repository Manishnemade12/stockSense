import { api } from "@/services/apiClient";

export type OperationType =
  | "RECEIPT"
  | "DELIVERY"
  | "INTERNAL_TRANSFER"
  | "ADJUSTMENT";

export type OperationStatus =
  | "DRAFT"
  | "WAITING"
  | "READY"
  | "DONE"
  | "CANCELED";

export interface StockOperation {
  id: number;
  reference_no: string;
  operation_type: OperationType;
  status: OperationStatus;
  warehouse_id: number;
  warehouse?: { id: number; name: string; code: string };
  source_location_id?: number | null;
  source_location?: { id: number; name: string; code: string; location_type?: string } | null;
  destination_location_id?: number | null;
  destination_location?: { id: number; name: string; code: string; location_type?: string } | null;
  partner_id?: number | null;
  partner?: { id: number; name: string; type?: string; email?: string; phone?: string; address?: string } | null;
  scheduled_date?: string | null;
  validated_date?: string | null;
  created_by?: number | null;
  responsible_user_id?: number | null;
  notes?: string | null;
  is_late?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  lines?: StockOperationLine[];
}

export interface StockOperationLine {
  id: number;
  operation_id?: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  uom_id?: number | null;
  uom?: { id: number; name: string; code: string };
  quantity_planned: number;
  quantity_done: number;
  notes?: string | null;
  available_at_source?: number | null;
  is_short?: boolean;
}

export interface StockAdjustmentLine {
  id: number;
  operation_id?: number;
  product_id: number;
  product?: { id: number; name: string; sku: string };
  location_id: number;
  location?: { id: number; name: string; code: string };
  recorded_quantity: number;
  counted_quantity: number;
  notes?: string | null;
}

export const OP_META: Record<
  OperationType,
  { label: string; plural: string; code: string }
> = {
  RECEIPT: { label: "Receipt", plural: "Receipts", code: "IN" },
  DELIVERY: { label: "Delivery", plural: "Deliveries", code: "OUT" },
  INTERNAL_TRANSFER: { label: "Internal Transfer", plural: "Internal Transfers", code: "INT" },
  ADJUSTMENT: { label: "Adjustment", plural: "Adjustments", code: "ADJ" },
};

export function normalizeOpType(input?: string): OperationType {
  if (!input) return "RECEIPT";
  const upper = input.toUpperCase();
  if (upper === "RECEIPTS" || upper === "RECEIPT") return "RECEIPT";
  if (upper === "DELIVERIES" || upper === "DELIVERY") return "DELIVERY";
  if (
    upper === "TRANSFERS" ||
    upper === "TRANSFER" ||
    upper === "INTERNAL_TRANSFERS" ||
    upper === "INTERNAL_TRANSFER"
  )
    return "INTERNAL_TRANSFER";
  if (upper === "ADJUSTMENTS" || upper === "ADJUSTMENT") return "ADJUSTMENT";
  return "RECEIPT";
}

export const STATUS_STYLES: Record<OperationStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  WAITING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  READY: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  DONE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  CANCELED: "bg-destructive/15 text-destructive",
};

export interface OperationLineInput {
  product_id: number;
  quantity_planned?: number;
  quantity_done?: number;
  location_id?: number;
  counted_quantity?: number;
  id?: number;
  notes?: string;
}

export interface OperationPayload {
  operation_type: OperationType;
  warehouse_id: number;
  source_location_id?: number | null;
  destination_location_id?: number | null;
  partner_id?: number | null;
  responsible_user_id?: number | null;
  scheduled_date?: string;
  notes?: string;
  lines: OperationLineInput[];
}

export async function createOperation(payload: OperationPayload): Promise<number> {
  const data = await api.post<StockOperation>("/operations", payload);
  return data.id;
}

export async function updateOperation(
  id: number,
  payload: Partial<OperationPayload>,
): Promise<void> {
  await api.put(`/operations/${id}`, payload);
}

export async function confirmOperation(id: number): Promise<OperationStatus> {
  const data = await api.post<StockOperation>(`/operations/${id}/confirm`);
  return data.status;
}

export async function validateOperation(id: number): Promise<void> {
  await api.post(`/operations/${id}/validate`);
}

export async function cancelOperation(id: number): Promise<void> {
  await api.post(`/operations/${id}/cancel`);
}

export async function setStock(
  productId: number,
  locationId: number,
  counted: number,
): Promise<void> {
  await api.put(`/products/${productId}/stock/${locationId}`, {
    counted_quantity: counted,
  });
}

/** Free (unreserved) quantity of a product at a location. */
export async function freeQtyAt(
  productId: number,
  locationId: number,
): Promise<number> {
  try {
    const list = await api.get<Array<{ location_id: number; on_hand: number; reserved: number; free_to_use: number }>>(
      `/products/${productId}/stock`
    );
    const item = list?.find((l) => l.location_id === locationId);
    return item ? item.free_to_use : 0;
  } catch {
    return 0;
  }
}
