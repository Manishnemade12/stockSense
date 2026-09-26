import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmOperation,
  validateOperation,
  cancelOperation,
  updateOperation,
  createOperation,
  normalizeOpType,
  STATUS_STYLES,
  OP_META,
  type OperationType,
  type OperationStatus,
} from "@/lib/stocksense";
import { useIsManager, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OperationStatusBadge } from "@/components/operation-status-badge";
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
  head: ({ params }) => {
    const norm = normalizeOpType(params.type);
    return {
      meta: [
        {
          title: `${OP_META[norm]?.label ?? "Operation"} Detail — StockSense`,
        },
      ],
    };
  },
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

function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id,name,code,location_type,warehouse_id")
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
  const opType = normalizeOpType(type);
  const opId = Number(id);
  const meta = OP_META[opType];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const { data: isManager } = useIsManager(userId);

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [qtyDoneEdits, setQtyDoneEdits] = useState<Record<number, string>>({});
  const [adjCountedEdits, setAdjCountedEdits] = useState<Record<number, string>>({});
  // Inline new-line form
  const [addingLine, setAddingLine] = useState(false);
  const [newLineProductId, setNewLineProductId] = useState("");
  const [newLineQty, setNewLineQty] = useState("1");
  const [newLineLocationId, setNewLineLocationId] = useState(""); // for ADJUSTMENT
  const [deletingLineId, setDeletingLineId] = useState<number | null>(null);

  const { data: products } = useProducts();
  const { data: allLocations } = useLocations();
  const internalLocs = (allLocations ?? []).filter((l) => l.location_type === "INTERNAL");

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

  // Rule 2: block validate if ALL lines have qty_done = 0
  function handleValidateClick() {
    if (opType !== "ADJUSTMENT") {
      const opLines = op?.stock_operation_lines ?? [];
      const allZero = opLines.length > 0 && opLines.every(
        (l: any) => {
          const edited = qtyDoneEdits[l.id];
          const val = edited !== undefined ? Number(edited) : Number(l.quantity_done ?? 0);
          return val === 0;
        }
      );
      if (allZero) {
        toast.error("Cannot validate — all lines have Qty Done = 0. Enter at least one quantity.");
        return;
      }
    }
    setConfirmValidate(true);
  }

  // Add a new product line to an existing DRAFT/READY operation
  async function handleAddLine() {
    if (!newLineProductId) {
      toast.error("Select a product");
      return;
    }
    const qtyVal = Number(newLineQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error("Enter a valid quantity > 0");
      return;
    }
    setBusy(true);
    try {
      const linePayload: any = {
        product_id: Number(newLineProductId),
        quantity_planned: qtyVal,
      };
      if (opType === "ADJUSTMENT" && newLineLocationId) {
        linePayload.location_id = Number(newLineLocationId);
        linePayload.counted_quantity = qtyVal;
      }
      await updateOperation(opId, { lines: [linePayload] });
      toast.success("Product line added");
      qc.invalidateQueries({ queryKey: ["operation", opId] });
      setAddingLine(false);
      setNewLineProductId("");
      setNewLineQty("1");
      setNewLineLocationId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add line");
    } finally {
      setBusy(false);
    }
  }

  // Delete a line from the operation
  async function handleDeleteLine(lineId: number) {
    setBusy(true);
    try {
      if (opType === "ADJUSTMENT") {
        const { error } = await supabase
          .from("stock_adjustment_lines")
          .delete()
          .eq("id", lineId)
          .eq("operation_id", opId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("stock_operation_lines")
          .delete()
          .eq("id", lineId)
          .eq("operation_id", opId);
        if (error) throw error;
      }
      toast.success("Line removed");
      qc.invalidateQueries({ queryKey: ["operation", opId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove line");
    } finally {
      setBusy(false);
      setDeletingLineId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
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

  const currentLines =
    opType === "ADJUSTMENT"
      ? op.stock_adjustment_lines ?? []
      : op.stock_operation_lines ?? [];

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
        <OperationStatusBadge status={op.status} size="default" />
        {op.scheduled_date && new Date(op.scheduled_date) < new Date() &&
          op.status !== "DONE" && op.status !== "CANCELED" && (
          <Badge className="border-0 bg-orange-500/15 text-orange-600 dark:text-orange-400">
            Late
          </Badge>
        )}
        {isLocked && (
          <Badge variant="outline" className="ml-auto text-muted-foreground">
            {isDone ? "Read-only — Validated" : "Read-only — Canceled"}
          </Badge>
        )}
      </div>

      {/* Short stock alert for Delivery/Transfer */}
      {hasShortLines && !isLocked && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>⚠️ Some items are out of stock at the source location.</strong>{" "}
            Confirming this operation will set status to <strong>WAITING</strong> until stock becomes available.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {!isLocked && op.status === "DRAFT" && (
          <Button
            disabled={busy}
            onClick={() => run(() => confirmOperation(opId).then(() => {}), "Status → READY (or WAITING)")}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ✅ To Do (Confirm)
          </Button>
        )}
        {!isLocked && op.status === "READY" && (
          <Button
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={handleValidateClick}
          >
            <CheckCircle2 className="h-4 w-4" />
            Validate
          </Button>
        )}
        {(!isLocked && (isManager || (op.status === "DRAFT" && op.created_by === userId))) && (
          <Button
            variant="outline"
            disabled={busy}
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setConfirmCancel(true)}
          >
            <X className="mr-1.5 h-4 w-4" />
            Cancel Operation
          </Button>
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
      </div>

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
          onDeleteLine={(id) => setDeletingLineId(id)}
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
          onDeleteLine={(id) => setDeletingLineId(id)}
        />
      )}

      {/* Inline Add Line */}
      {!isLocked && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm text-muted-foreground">Add Product Line</CardTitle>
            {!addingLine && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setAddingLine(true)}
              >
                <Plus className="h-3.5 w-3.5" /> New Product
              </Button>
            )}
          </CardHeader>
          {addingLine && (
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-48 space-y-1">
                  <Label className="text-xs">Product *</Label>
                  <Select value={newLineProductId} onValueChange={setNewLineProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {(products ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}{" "}
                          <span className="text-muted-foreground text-xs">[{p.sku}]</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {opType === "ADJUSTMENT" && (
                  <div className="w-44 space-y-1">
                    <Label className="text-xs">Location *</Label>
                    <Select value={newLineLocationId} onValueChange={setNewLineLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {internalLocs.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="w-28 space-y-1">
                  <Label className="text-xs">
                    {opType === "ADJUSTMENT" ? "Counted Qty *" : "Qty Planned *"}
                  </Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(e.target.value)}
                  />
                </div>
                <div className="flex gap-1.5 pb-0.5">
                  <Button size="sm" onClick={handleAddLine} disabled={busy} className="gap-1">
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingLine(false);
                      setNewLineProductId("");
                      setNewLineQty("1");
                      setNewLineLocationId("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Delete Line Confirm */}
      <AlertDialog open={deletingLineId !== null} onOpenChange={(o) => !o && setDeletingLineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line?</AlertDialogTitle>
            <AlertDialogDescription>
              This product line will be permanently removed from the operation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingLineId && handleDeleteLine(deletingLineId)}
            >
              Remove line
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validate Confirm */}
      <AlertDialog open={confirmValidate} onOpenChange={setConfirmValidate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validate this operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the operation as DONE and write the stock changes.
              This action is <strong>irreversible</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review first</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() =>
                run(() => validateOperation(opId), "Validated — stock updated!")
              }
            >
              Yes, Validate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  onDeleteLine,
}: {
  lines: any[];
  opType: OperationType;
  isLocked: boolean;
  edits: Record<number, string>;
  onEdit: (e: Record<number, string>) => void;
  onSave: () => void;
  busy: boolean;
  onDeleteLine: (id: number) => void;
}) {
  const hasEdits = Object.keys(edits).length > 0;
  const showShortCol = opType === "DELIVERY" || opType === "INTERNAL_TRANSFER";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Products</CardTitle>
        {!isLocked && hasEdits && (
          <Button size="sm" onClick={onSave} disabled={busy} className="gap-1">
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
              <TableHead className="text-right">Qty Done</TableHead>
              {showShortCol && (
                <TableHead className="text-right">Available</TableHead>
              )}
              {!isLocked && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showShortCol ? 5 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  No product lines — add one below.
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
                  <TableCell className="text-right">
                    {isLocked ? (
                      <span className={cn(Number(line.quantity_done) > 0 ? "font-semibold" : "text-muted-foreground")}>
                        {Number(line.quantity_done ?? 0).toLocaleString()}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        className={cn(
                          "w-24 ml-auto text-right",
                          line.is_short && "border-destructive focus-visible:ring-destructive",
                        )}
                        value={edits[line.id] ?? line.quantity_done ?? "0"}
                        onChange={(e) =>
                          onEdit({ ...edits, [line.id]: e.target.value })
                        }
                      />
                    )}
                  </TableCell>
                  {showShortCol && (
                    <TableCell
                      className={cn(
                        "text-right",
                        line.is_short && "text-destructive font-semibold",
                      )}
                    >
                      {line.available_at_source ?? "—"}
                    </TableCell>
                  )}
                  {!isLocked && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteLine(line.id)}
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
  onDeleteLine,
}: {
  lines: any[];
  isLocked: boolean;
  edits: Record<number, string>;
  onEdit: (e: Record<number, string>) => void;
  onSave: () => void;
  busy: boolean;
  onDeleteLine: (id: number) => void;
}) {
  const hasEdits = Object.keys(edits).length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Adjustment Lines</CardTitle>
        {!isLocked && hasEdits && (
          <Button size="sm" onClick={onSave} disabled={busy} className="gap-1">
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
              {!isLocked && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No adjustment lines — add one below.
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
                    {!isLocked && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteLine(line.id)}
                          title="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
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
