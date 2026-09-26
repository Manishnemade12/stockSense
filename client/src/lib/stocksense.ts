import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OperationType = Database["public"]["Enums"]["operation_type"];
export type OperationStatus = Database["public"]["Enums"]["operation_status"];
export type StockOperation = Database["public"]["Tables"]["stock_operations"]["Row"];
export type StockOperationLine =
  Database["public"]["Tables"]["stock_operation_lines"]["Row"];
export type StockAdjustmentLine =
  Database["public"]["Tables"]["stock_adjustment_lines"]["Row"];

export const OP_META: Record<
  OperationType,
  { label: string; plural: string; code: string }
> = {
  RECEIPT: { label: "Receipt", plural: "Receipts", code: "IN" },
  DELIVERY: { label: "Delivery", plural: "Deliveries", code: "OUT" },
  INTERNAL_TRANSFER: { label: "Internal Transfer", plural: "Internal Transfers", code: "INT" },
  ADJUSTMENT: { label: "Adjustment", plural: "Adjustments", code: "ADJ" },
};

export const STATUS_STYLES: Record<OperationStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  WAITING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  READY: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  DONE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  CANCELED: "bg-destructive/15 text-destructive",
};

function rpcError(error: { message: string } | null): never {
  const msg = error?.message ?? "Something went wrong";
  // Surface the friendly part of Postgres RAISE EXCEPTION messages
  const clean = msg.replace(/^.*?:\s*/, (m) =>
    m.includes("RAISE") ? "" : m,
  );
  throw new Error(clean);
}

export interface OperationLineInput {
  product_id: number;
  quantity_planned?: number;
  quantity_done?: number;
  location_id?: number;
  counted_quantity?: number;
  id?: number;
}

export interface OperationPayload {
  operation_type: OperationType;
  warehouse_id: number;
  source_location_id?: number | null;
  destination_location_id?: number | null;
  partner_id?: number | null;
  responsible_user_id?: string | null;
  scheduled_date?: string;
  notes?: string;
  lines: OperationLineInput[];
}

export async function createOperation(payload: OperationPayload): Promise<number> {
  const { data, error } = await supabase.rpc("create_operation", {
    _payload: payload as never,
  });
  if (error) rpcError(error);
  return data as number;
}

export async function updateOperation(
  id: number,
  payload: Partial<OperationPayload>,
): Promise<void> {
  const { error } = await supabase.rpc("update_operation", {
    _id: id,
    _payload: payload as never,
  });
  if (error) rpcError(error);
}

export async function confirmOperation(id: number): Promise<OperationStatus> {
  const { data, error } = await supabase.rpc("confirm_operation", { _id: id });
  if (error) rpcError(error);
  return data as OperationStatus;
}

export async function validateOperation(id: number): Promise<void> {
  const { error } = await supabase.rpc("validate_operation", { _id: id });
  if (error) rpcError(error);
}

export async function cancelOperation(id: number): Promise<void> {
  const { error } = await supabase.rpc("cancel_operation", { _id: id });
  if (error) rpcError(error);
}

export async function setStock(
  productId: number,
  locationId: number,
  counted: number,
): Promise<void> {
  const { error } = await supabase.rpc("set_stock", {
    _product: productId,
    _location: locationId,
    _counted: counted,
  });
  if (error) rpcError(error);
}

/** Free (unreserved) quantity of a product at a location. */
export async function freeQtyAt(
  productId: number,
  locationId: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("stock_quants")
    .select("quantity, reserved_quantity")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 0;
  return Number(data.quantity) - Number(data.reserved_quantity);
}
