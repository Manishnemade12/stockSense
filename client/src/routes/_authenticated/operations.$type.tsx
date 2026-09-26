import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ChevronDown,
  KanbanSquare,
  List,
  Loader2,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmOperation,
  validateOperation,
  cancelOperation,
  createOperation,
  STATUS_STYLES,
  OP_META,
  type OperationType,
  type OperationStatus,
} from "@/lib/stocksense";
import { useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/operations/$type")({
  validateSearch: (search: Record<string, unknown>): { status?: string | undefined; view?: "list" | "kanban" | undefined } => ({
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
    view: search["view"] === "kanban" ? "kanban" : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      {
        title: `${OP_META[params.type as OperationType]?.plural ?? "Operations"} — StockSense`,
      },
    ],
  }),
  component: OperationsListPage,
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function isLate(op: { scheduled_date: string; status: OperationStatus }) {
  return (
    new Date(op.scheduled_date) < new Date() &&
    op.status !== "DONE" &&
    op.status !== "CANCELED"
  );
}

function useMasters() {
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id,name,code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const locations = useQuery({
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
  const partners = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id,name,type,address")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const products = useQuery({
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
  return { warehouses, locations, partners, products };
}

// ─── List Page ────────────────────────────────────────────────────────────────

function OperationsListPage() {
  const { type } = Route.useParams();
  const opType = type as OperationType;
  const meta = OP_META[opType];
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = useSessionUserId();

  const searchParams = Route.useSearch();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "kanban">(searchParams.view || "list");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.status || "ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (searchParams.status) setStatusFilter(searchParams.status);
    if (searchParams.view) setView(searchParams.view);
  }, [searchParams.status, searchParams.view]);

  const { data: ops, isLoading } = useQuery({
    queryKey: ["operations", opType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_operations")
        .select(`
          *,
          partner:partners(id,name),
          src:locations!stock_operations_source_location_id_fkey(id,name,code),
          dst:locations!stock_operations_destination_location_id_fkey(id,name,code),
          warehouse:warehouses(id,name,code)
        `)
        .eq("operation_type", opType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (ops ?? []).filter((op) => {
    const matchSearch =
      !search ||
      op.reference_no?.toLowerCase().includes(search.toLowerCase()) ||
      op.partner?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || op.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleConfirm(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const newStatus = await confirmOperation(id);
      toast.success(`Status → ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["operations", opType] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleValidate(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await validateOperation(id);
      toast.success("Operation validated — stock updated!");
      qc.invalidateQueries({ queryKey: ["operations", opType] });
      qc.invalidateQueries({ queryKey: ["stock-totals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function handleCancel(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await cancelOperation(id);
      toast.success("Operation canceled");
      qc.invalidateQueries({ queryKey: ["operations", opType] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
      setCancelTarget(null);
    }
  }

  const statuses: OperationStatus[] = ["DRAFT", "WAITING", "READY", "DONE", "CANCELED"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{meta.plural}</h1>
          <p className="text-sm text-muted-foreground">
            Manage all {meta.plural.toLowerCase()} and their status.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New {meta.label}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search reference or contact…`}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="rounded-none px-3"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={view === "kanban" ? "secondary" : "ghost"}
            className="rounded-none px-3"
            onClick={() => setView("kanban")}
          >
            <KanbanSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : view === "list" ? (
        <ListView
          ops={filtered}
          opType={opType}
          busy={busy}
          onConfirm={handleConfirm}
          onValidate={handleValidate}
          onCancel={(id) => setCancelTarget(id)}
          navigate={navigate}
        />
      ) : (
        <KanbanView
          ops={filtered}
          statuses={statuses}
          opType={opType}
          busy={busy}
          onConfirm={handleConfirm}
          onValidate={handleValidate}
          onCancel={(id) => setCancelTarget(id)}
          navigate={navigate}
        />
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateOperationDialog
          opType={opType}
          userId={userId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["operations", opType] });
          }}
        />
      )}

      {/* Cancel Confirm */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this operation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The operation will be marked as
              Canceled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
            >
              Cancel operation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  ops,
  opType,
  busy,
  onConfirm,
  onValidate,
  onCancel,
  navigate,
}: {
  ops: any[];
  opType: OperationType;
  busy: Record<number, boolean>;
  onConfirm: (id: number) => void;
  onValidate: (id: number) => void;
  onCancel: (id: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (ops.length === 0)
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No {OP_META[opType].plural.toLowerCase()} found. Create your first one.
      </p>
    );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            {opType !== "ADJUSTMENT" && <TableHead>From</TableHead>}
            {opType !== "ADJUSTMENT" && <TableHead>To</TableHead>}
            {(opType === "RECEIPT" || opType === "DELIVERY") && (
              <TableHead>Contact</TableHead>
            )}
            <TableHead>Schedule Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ops.map((op) => (
            <TableRow
              key={op.id}
              className="cursor-pointer hover:bg-accent/40"
              onClick={() =>
                navigate({
                  to: "/operations/$type/$id",
                  params: { type: opType, id: String(op.id) },
                })
              }
            >
              <TableCell className="font-mono font-medium">
                {op.reference_no ?? "—"}
                {isLate(op) && (
                  <Badge className="ml-2 border-0 bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px]">
                    Late
                  </Badge>
                )}
              </TableCell>
              {opType !== "ADJUSTMENT" && (
                <TableCell className="text-muted-foreground text-sm">
                  {op.src?.code ?? op.src?.name ?? "—"}
                </TableCell>
              )}
              {opType !== "ADJUSTMENT" && (
                <TableCell className="text-muted-foreground text-sm">
                  {op.dst?.code ?? op.dst?.name ?? "—"}
                </TableCell>
              )}
              {(opType === "RECEIPT" || opType === "DELIVERY") && (
                <TableCell>{op.partner?.name ?? "—"}</TableCell>
              )}
              <TableCell>
                {op.scheduled_date
                  ? new Date(op.scheduled_date).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn("border-0", STATUS_STYLES[op.status as OperationStatus])}
                >
                  {op.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <ActionButtons
                  op={op}
                  busy={busy}
                  onConfirm={onConfirm}
                  onValidate={onValidate}
                  onCancel={onCancel}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({
  ops,
  statuses,
  opType,
  busy,
  onConfirm,
  onValidate,
  onCancel,
  navigate,
}: {
  ops: any[];
  statuses: OperationStatus[];
  opType: OperationType;
  busy: Record<number, boolean>;
  onConfirm: (id: number) => void;
  onValidate: (id: number) => void;
  onCancel: (id: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const grouped = statuses.reduce(
    (acc, s) => ({ ...acc, [s]: ops.filter((o) => o.status === s) }),
    {} as Record<OperationStatus, any[]>,
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statuses.map((s) => (
        <div key={s} className="flex-shrink-0 w-64">
          <div className="mb-2 flex items-center justify-between">
            <Badge className={cn("border-0", STATUS_STYLES[s])}>
              {s}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {grouped[s].length}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[s].length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6 border rounded-lg border-dashed">
                No {s.toLowerCase()} operations
              </p>
            )}
            {grouped[s].map((op) => (
              <Card
                key={op.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() =>
                  navigate({
                    to: "/operations/$type/$id",
                    params: { type: opType, id: String(op.id) },
                  })
                }
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-1">
                    <CardTitle className="text-sm font-mono">
                      {op.reference_no ?? "Draft"}
                    </CardTitle>
                    {isLate(op) && (
                      <Badge className="border-0 bg-orange-500/15 text-orange-600 text-[10px] shrink-0">
                        Late
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-1">
                  {op.partner?.name && <p>{op.partner.name}</p>}
                  {op.scheduled_date && (
                    <p>{new Date(op.scheduled_date).toLocaleDateString()}</p>
                  )}
                  <div onClick={(e) => e.stopPropagation()} className="pt-1">
                    <ActionButtons
                      op={op}
                      busy={busy}
                      onConfirm={onConfirm}
                      onValidate={onValidate}
                      onCancel={onCancel}
                      compact
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  op,
  busy,
  onConfirm,
  onValidate,
  onCancel,
  compact = false,
}: {
  op: any;
  busy: Record<number, boolean>;
  onConfirm: (id: number) => void;
  onValidate: (id: number) => void;
  onCancel: (id: number) => void;
  compact?: boolean;
}) {
  const isbusy = busy[op.id];
  const size = compact ? "sm" : "sm";

  if (op.status === "DONE" || op.status === "CANCELED") return null;

  return (
    <div className={cn("flex gap-1", compact ? "flex-col" : "justify-end")}>
      {op.status === "DRAFT" && (
        <Button
          size={size}
          variant="outline"
          disabled={isbusy}
          onClick={() => onConfirm(op.id)}
          className="gap-1"
        >
          {isbusy && <Loader2 className="h-3 w-3 animate-spin" />}
          To Do
        </Button>
      )}
      {op.status === "READY" && (
        <Button
          size={size}
          disabled={isbusy}
          onClick={() => onValidate(op.id)}
          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isbusy && <Loader2 className="h-3 w-3 animate-spin" />}
          Validate
        </Button>
      )}
      <Button
        size={size}
        variant="ghost"
        disabled={isbusy}
        onClick={() => onCancel(op.id)}
        className="gap-1 text-destructive hover:text-destructive"
      >
        <X className="h-3 w-3" />
        {!compact && "Cancel"}
      </Button>
    </div>
  );
}

// ─── Create Operation Dialog ──────────────────────────────────────────────────

function CreateOperationDialog({
  opType,
  userId,
  onClose,
  onCreated,
}: {
  opType: OperationType;
  userId: string | undefined;
  onClose: () => void;
  onCreated: () => void;
}) {
  const meta = OP_META[opType];
  const { warehouses, locations, partners, products } = useMasters();
  const [busy, setBusy] = useState(false);

  const [warehouseId, setWarehouseId] = useState("");
  const [srcLocationId, setSrcLocationId] = useState("");
  const [dstLocationId, setDstLocationId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    { product_id: string; quantity_planned: string; location_id: string }[]
  >([{ product_id: "", quantity_planned: "1", location_id: "" }]);

  const internalLocs = (locations.data ?? []).filter(
    (l) => l.location_type === "INTERNAL",
  );
  const vendorLocs = (locations.data ?? []).filter(
    (l) => l.location_type === "VENDOR",
  );
  const customerLocs = (locations.data ?? []).filter(
    (l) => l.location_type === "CUSTOMER",
  );
  const supplierPartners = (partners.data ?? []).filter(
    (p) => p.type === "SUPPLIER",
  );
  const customerPartners = (partners.data ?? []).filter(
    (p) => p.type === "CUSTOMER",
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      { product_id: "", quantity_planned: "1", location_id: "" },
    ]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.product_id);
    if (validLines.length === 0) {
      toast.error("Add at least one product line");
      return;
    }
    setBusy(true);
    try {
      // Determine source/destination based on operation type
      let srcId: number | null = null;
      let dstId: number | null = null;
      let partnerIdNum: number | null = null;

      if (opType === "RECEIPT") {
        // src = vendor virtual location (auto), dst = selected internal location
        srcId = vendorLocs[0]?.id ?? null;
        dstId = dstLocationId ? Number(dstLocationId) : null;
        partnerIdNum = partnerId ? Number(partnerId) : null;
      } else if (opType === "DELIVERY") {
        // src = selected internal, dst = customer virtual (auto)
        srcId = srcLocationId ? Number(srcLocationId) : null;
        dstId = customerLocs[0]?.id ?? null;
        partnerIdNum = partnerId ? Number(partnerId) : null;
      } else if (opType === "INTERNAL_TRANSFER") {
        srcId = srcLocationId ? Number(srcLocationId) : null;
        dstId = dstLocationId ? Number(dstLocationId) : null;
      } else {
        // ADJUSTMENT — no src/dst
      }

      await createOperation({
        operation_type: opType,
        warehouse_id: Number(warehouseId),
        source_location_id: srcId,
        destination_location_id: dstId,
        partner_id: partnerIdNum,
        scheduled_date: new Date(scheduledDate || Date.now()).toISOString(),
        notes,
        lines: validLines.map((l) => ({
          product_id: Number(l.product_id),
          quantity_planned: Number(l.quantity_planned),
          ...(opType === "ADJUSTMENT" && l.location_id
            ? { location_id: Number(l.location_id), counted_quantity: Number(l.quantity_planned) }
            : {}),
        })),
      });
      toast.success(`${meta.label} created!`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New {meta.label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Warehouse */}
          <div className="space-y-1.5">
            <Label>Warehouse *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {(warehouses.data ?? []).map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Partner (Receipt = Supplier, Delivery = Customer) */}
          {opType === "RECEIPT" && (
            <div className="space-y-1.5">
              <Label>Receive From (Supplier) *</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierPartners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {opType === "DELIVERY" && (
            <div className="space-y-1.5">
              <Label>Deliver To (Customer) *</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customerPartners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Locations */}
          {(opType === "RECEIPT") && (
            <div className="space-y-1.5">
              <Label>Destination Location *</Label>
              <Select value={dstLocationId} onValueChange={setDstLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Stock location" />
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
          {(opType === "DELIVERY" || opType === "INTERNAL_TRANSFER") && (
            <div className="space-y-1.5">
              <Label>Source Location *</Label>
              <Select value={srcLocationId} onValueChange={setSrcLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick from" />
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
          {opType === "INTERNAL_TRANSFER" && (
            <div className="space-y-1.5">
              <Label>Destination Location *</Label>
              <Select value={dstLocationId} onValueChange={setDstLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Move to" />
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

          {/* Schedule Date */}
          <div className="space-y-1.5">
            <Label>Scheduled Date *</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          {/* Product Lines */}
          <div className="space-y-2">
            <Label>Products *</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Select
                  value={line.product_id}
                  onValueChange={(v) =>
                    setLines((prev) =>
                      prev.map((l, idx) =>
                        idx === i ? { ...l, product_id: v } : l,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {(products.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          [{p.sku}]
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {opType === "ADJUSTMENT" && (
                  <Select
                    value={line.location_id}
                    onValueChange={(v) =>
                      setLines((prev) =>
                        prev.map((l, idx) =>
                          idx === i ? { ...l, location_id: v } : l,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-36">
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
                )}

                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  className="w-24"
                  placeholder={opType === "ADJUSTMENT" ? "Counted" : "Qty"}
                  value={line.quantity_planned}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, idx) =>
                        idx === i
                          ? { ...l, quantity_planned: e.target.value }
                          : l,
                      ),
                    )
                  }
                />
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add product
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !warehouseId}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Create {meta.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
