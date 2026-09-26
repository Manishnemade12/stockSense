import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmOperation,
  validateOperation,
  cancelOperation,
  updateOperation,
  STATUS_STYLES,
  OP_META,
  type OperationType,
  type OperationStatus,
} from "@/lib/stocksense";
import { useIsManager, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/operations/$type/$id")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${OP_META[params.type as OperationType]?.label ?? "Operation"} Detail — StockSense`,
      },
    ],
  }),
  component: OperationDetailPage,
});

// ─── Master data hooks ────────────────────────────────────────────────────────

function useProducts() {
  return useQuery({
    queryKey: ["products-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,uom_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

function OperationDetailPage() {
  const { type, id } = Route.useParams();
  const opType = type as OperationType;
  const opId = Number(id);
  const meta = OP_META[opType];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const { data: isManager } = useIsManager(userId);

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [qtyDoneEdits, setQtyDoneEdits] = useState<Record<number, string>>({});
  const [adjCountedEdits, setAdjCountedEdits] = useState<Record<number, string>>({});
  const { data: products } = useProducts();

  const { data: op, isLoading, error } = useQuery({
    queryKey: ["operation", opId],
    queryFn: async () => {
      if (opType === "ADJUSTMENT") {
        const { data, error } = await supabase
          .from("stock_operations")
          .select(`
            *,
            warehouse:warehouses(id,name,code),
            src:locations!stock_operations_source_location_id_fkey(id,name,code),
            dst:locations!stock_operations_destination_location_id_fkey(id,name,code),
            partner:partners(id,name,address),
            responsible:profiles!stock_operations_responsible_user_id_fkey(id,full_name,login_id),
            stock_adjustment_lines(
              id, product_id, location_id, uom_id,
              recorded_quantity, counted_quantity,
              product:products(id,name,sku),
              location:locations(id,name,code)
            )
          `)
          .eq("id", opId)
          .single();
        if (error) throw error;
        return data as any;
      } else {
        const { data, error } = await supabase
          .from("stock_operations")
          .select(`
            *,
            warehouse:warehouses(id,name,code),
            src:locations!stock_operations_source_location_id_fkey(id,name,code),
            dst:locations!stock_operations_destination_location_id_fkey(id,name,code),
            partner:partners(id,name,address),
            responsible:profiles!stock_operations_responsible_user_id_fkey(id,full_name,login_id),
            stock_operation_lines(
              id, product_id, uom_id,
              quantity_planned, quantity_done,
              product:products(id,name,sku)
            )
          `)
          .eq("id", opId)
          .single();
        if (error) throw error;
        // Compute is_short for delivery/transfer lines
        if (opType === "DELIVERY" || opType === "INTERNAL_TRANSFER") {
          const enrichedLines = await Promise.all(
            (data.stock_operation_lines ?? []).map(async (line: any) => {
              if (!data.source_location_id) return { ...line, is_short: false, available_at_source: 0 };
              const { data: q } = await supabase
                .from("stock_quants")
                .select("quantity,reserved_quantity")
                .eq("product_id", line.product_id)
                .eq("location_id", data.source_location_id)
                .maybeSingle();
              const free = q ? Number(q.quantity) - Number(q.reserved_quantity) : 0;
              return {
                ...line,
                available_at_source: free,
                is_short: Number(line.quantity_planned) > free,
              };
            }),
          );
          return { ...data, stock_operation_lines: enrichedLines } as any;
        }
        return data as any;
      }
    },
  });

  const isDone = op?.status === "DONE";
  const isCanceled = op?.status === "CANCELED";
  const isLocked = isDone || isCanceled;

  const hasShortLines =
    (op?.stock_operation_lines ?? []).some((l: any) => l.is_short);

  async function run(fn: () => Promise<void>, successMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ["operation", opId] });
      qc.invalidateQueries({ queryKey: ["operations", opType] });
      qc.invalidateQueries({ queryKey: ["stock-totals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveQtyDone() {
    const lines = Object.entries(qtyDoneEdits).map(([lineId, val]) => ({
      id: Number(lineId),
      quantity_done: Number(val),
    }));
    if (lines.length === 0) {
      toast.info("No changes to save");
      return;
    }
    await run(
      () => updateOperation(opId, { lines: lines as any }),
      "Quantities saved",
    );
    setQtyDoneEdits({});
  }

  async function handleSaveAdjCounted() {
    const lines = Object.entries(adjCountedEdits).map(([lineId, val]) => ({
      id: Number(lineId),
      counted_quantity: Number(val),
    }));
    if (lines.length === 0) {
      toast.info("No changes to save");
      return;
    }
    await run(
      () => updateOperation(opId, { lines: lines as any }),
      "Counted quantities saved",
    );
    setAdjCountedEdits({});
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !op) {
    return (
      <div className="py-16 text-center">
        <p className="text-destructive">Operation not found.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() =>
            navigate({ to: "/operations/$type", params: { type: opType } })
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/operations/$type" params={{ type: opType }}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> {meta.plural}
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-xl font-bold font-mono tracking-tight">
          {op.reference_no ?? `New ${meta.label}`}
        </h1>
        <Badge className={cn("border-0", STATUS_STYLES[op.status as OperationStatus])}>
          {op.status}
        </Badge>
        {op.scheduled_date && new Date(op.scheduled_date) < new Date() &&
          op.status !== "DONE" && op.status !== "CANCELED" && (
          <Badge className="border-0 bg-orange-500/15 text-orange-600 dark:text-orange-400">
            Late
          </Badge>
        )}
      </div>

      {/* Short stock alert for Delivery/Transfer */}
      {hasShortLines && !isLocked && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Some items are out of stock at the source location. This operation
          will go to WAITING on confirm.
        </div>
      )}

      {/* Action Buttons */}
      {!isLocked && (
        <div className="flex flex-wrap gap-2">
          {op.status === "DRAFT" && (
            <Button
              disabled={busy}
              onClick={() => run(() => confirmOperation(opId).then(() => {}), "Status → READY (or WAITING)")}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              To Do
            </Button>
          )}
          {op.status === "READY" && (
            <Button
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => run(() => validateOperation(opId), "Validated — stock updated!")}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Validate
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel Operation
          </Button>
        </div>
      )}
      {isDone && (
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-4 w-4" /> Print Slip
        </Button>
      )}

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Field label="Reference" value={op.reference_no ?? "—"} mono />
          <Field label="Warehouse" value={op.warehouse?.name ?? "—"} />
          {op.src && <Field label="From" value={`${op.src.code} — ${op.src.name}`} />}
          {op.dst && <Field label="To" value={`${op.dst.code} — ${op.dst.name}`} />}
          {op.partner && (
            <Field label={opType === "RECEIPT" ? "Supplier" : "Customer"} value={op.partner.name} />
          )}
          {op.partner?.address && opType === "DELIVERY" && (
            <Field label="Delivery Address" value={op.partner.address} />
          )}
          <Field
            label="Scheduled Date"
            value={op.scheduled_date ? new Date(op.scheduled_date).toLocaleDateString() : "—"}
          />
          {op.validated_date && (
            <Field
              label="Validated Date"
              value={new Date(op.validated_date).toLocaleDateString()}
            />
          )}
          <Field
            label="Responsible"
            value={op.responsible?.full_name ?? op.responsible?.login_id ?? "—"}
          />
          {op.notes && <Field label="Notes" value={op.notes} />}
        </CardContent>
      </Card>

      {/* Lines */}
      {opType === "ADJUSTMENT" ? (
        <AdjustmentLinesTable
          lines={op.stock_adjustment_lines ?? []}
          isLocked={isLocked}
          edits={adjCountedEdits}
          onEdit={setAdjCountedEdits}
          onSave={handleSaveAdjCounted}
          busy={busy}
        />
      ) : (
        <OperationLinesTable
          lines={op.stock_operation_lines ?? []}
          opType={opType}
          isLocked={isLocked}
          edits={qtyDoneEdits}
          onEdit={setQtyDoneEdits}
          onSave={handleSaveQtyDone}
          busy={busy}
        />
      )}

      {/* Cancel Confirm */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The operation will be marked as Canceled
              and any reservations will be released.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                run(() => cancelOperation(opId), "Operation canceled")
              }
            >
              Cancel Operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Lines Tables ─────────────────────────────────────────────────────────────

function OperationLinesTable({
  lines,
  opType,
  isLocked,
  edits,
  onEdit,
  onSave,
  busy,
}: {
  lines: any[];
  opType: OperationType;
  isLocked: boolean;
  edits: Record<number, string>;
  onEdit: (e: Record<number, string>) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Products</CardTitle>
        {!isLocked && hasEdits && (
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save quantities
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty Planned</TableHead>
              {!isLocked && <TableHead className="text-right">Qty Done</TableHead>}
              {(opType === "DELIVERY" || opType === "INTERNAL_TRANSFER") && (
                <TableHead className="text-right">Available</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  No product lines
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => (
                <TableRow
                  key={line.id}
                  className={cn(
                    line.is_short && "bg-destructive/8 text-destructive",
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {line.is_short && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-medium">{line.product?.name}</span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {line.product?.sku}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(line.quantity_planned).toLocaleString()}
                  </TableCell>
                  {!isLocked && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-24 ml-auto text-right"
                        value={edits[line.id] ?? line.quantity_done ?? "0"}
                        onChange={(e) =>
                          onEdit({ ...edits, [line.id]: e.target.value })
                        }
                      />
                    </TableCell>
                  )}
                  {(opType === "DELIVERY" || opType === "INTERNAL_TRANSFER") && (
                    <TableCell
                      className={cn(
                        "text-right",
                        line.is_short && "text-destructive font-semibold",
                      )}
                    >
                      {line.available_at_source ?? "—"}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdjustmentLinesTable({
  lines,
  isLocked,
  edits,
  onEdit,
  onSave,
  busy,
}: {
  lines: any[];
  isLocked: boolean;
  edits: Record<number, string>;
  onEdit: (e: Record<number, string>) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Adjustment Lines</CardTitle>
        {!isLocked && hasEdits && (
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save counts
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Recorded Qty</TableHead>
              <TableHead className="text-right">Counted Qty</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No adjustment lines
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => {
                const recorded = Number(line.recorded_quantity ?? 0);
                const counted =
                  edits[line.id] !== undefined
                    ? Number(edits[line.id])
                    : Number(line.counted_quantity ?? 0);
                const diff = counted - recorded;

                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <span className="font-medium">{line.product?.name}</span>
                      <Badge
                        variant="outline"
                        className="ml-2 font-mono text-[10px]"
                      >
                        {line.product?.sku}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.location?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {recorded}
                    </TableCell>
                    <TableCell className="text-right">
                      {isLocked ? (
                        <span>{Number(line.counted_quantity ?? 0)}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          className="w-24 ml-auto text-right"
                          value={edits[line.id] ?? line.counted_quantity ?? "0"}
                          onChange={(e) =>
                            onEdit({ ...edits, [line.id]: e.target.value })
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        diff > 0 && "text-emerald-600 dark:text-emerald-400",
                        diff < 0 && "text-destructive",
                      )}
                    >
                      {diff > 0 ? `+${diff}` : diff === 0 ? "0" : diff}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}
