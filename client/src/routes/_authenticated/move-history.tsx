import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "@/services/apiClient";
import {
  STATUS_STYLES,
  OP_META,
  type OperationType,
  type OperationStatus,
} from "@/lib/stocksense";
import { useIsManager, useProfile, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/move-history")({
  validateSearch: (s: Record<string, unknown>) => ({
    view: s["view"] === "kanban" ? "kanban" as const : "list" as const,
    page: typeof s["page"] === "number" ? s["page"] : 1,
  }),
  head: () => ({
    meta: [
      { title: "Move History — StockSense" },
      { name: "description", content: "Full stock movement and ledger history across all operations." },
    ],
  }),
  component: MoveHistoryPage,
});

const PAGE_SIZE = 50;
const STATUSES: OperationStatus[] = ["DRAFT", "WAITING", "READY", "DONE", "CANCELED"];

// ─── Master data hooks ────────────────────────────────────────────────────────

function useMasters() {
  const products = useQuery({
    queryKey: ["products-simple"],
    queryFn: async () => {
      const res = await api.get<any>("/products");
      return Array.isArray(res) ? res : res?.items || [];
    },
  });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const data = await api.get<any[]>("/locations");
      return data ?? [];
    },
  });
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const data = await api.get<any[]>("/warehouses");
      return data ?? [];
    },
  });
  return { products, locations, warehouses };
}

// ─── Data hook ────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  opType: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
}

function useMoveHistory(filters: Filters) {
  return useQuery({
    queryKey: ["move-history", filters],
    queryFn: async () => {
      const ops = await api.get<any[]>("/operations", {
        type: filters.opType && filters.opType !== "ALL" ? filters.opType : undefined,
        warehouse_id: filters.warehouseId ? Number(filters.warehouseId) : undefined,
        limit: 100,
      });

      // Expand to one row per product line (per spec §6.8)
      const rows: any[] = [];
      for (const op of ops ?? []) {
        const lines = op.lines ?? [];

        if (lines.length === 0) {
          rows.push({
            ...op,
            line: null,
            src: op.source_location,
            dst: op.destination_location,
          });
        } else {
          for (const line of lines) {
            rows.push({
              ...op,
              line,
              src: op.source_location,
              dst: op.destination_location,
            });
          }
        }
      }
      return rows;
    },
    placeholderData: (prev: any) => prev,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowBorderColor(opType: OperationType) {
  if (opType === "RECEIPT") return "border-l-2 border-l-emerald-500";
  if (opType === "DELIVERY") return "border-l-2 border-l-destructive";
  if (opType === "INTERNAL_TRANSFER") return "border-l-2 border-l-blue-500";
  return "border-l-2 border-l-amber-500";
}

function rowBgColor(opType: OperationType) {
  if (opType === "RECEIPT") return "bg-emerald-500/5";
  if (opType === "DELIVERY") return "bg-destructive/5";
  return "";
}

function qtyDisplay(row: any): string {
  if (!row.line) return "—";
  if (row.status === "DONE") {
    const q = row.line.quantity_done ?? row.line.counted_quantity;
    return q != null ? Number(q).toLocaleString() : "—";
  }
  return row.line.quantity_planned != null
    ? Number(row.line.quantity_planned).toLocaleString()
    : "—";
}

function qtyTextColor(opType: OperationType) {
  if (opType === "RECEIPT") return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (opType === "DELIVERY") return "text-destructive font-semibold";
  return "";
}

function qtySign(opType: OperationType) {
  if (opType === "RECEIPT") return "+";
  if (opType === "DELIVERY") return "−";
  return "";
}

// ─── Main Component ───────────────────────────────────────────────────────────

function MoveHistoryPage() {
  const { view, page } = Route.useSearch();
  const navigate = useNavigate();
  const { products, locations, warehouses } = useMasters();
  const userId = useSessionUserId();
  const { data: profile } = useProfile(userId);
  const { data: isManager } = useIsManager(userId);

  const [search, setSearch] = useState("");
  const [opType, setOpType] = useState("ALL");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentPage = page ?? 1;
  const currentView = view ?? "list";

  // Per §3: Staff move history is scoped to their own assigned warehouse
  const effectiveWarehouseId = isManager
    ? warehouseId
    : profile?.warehouse_id
      ? String(profile.warehouse_id)
      : "1";

  const { data: allRows, isLoading } = useMoveHistory({
    search,
    opType,
    productId,
    locationId,
    warehouseId: effectiveWarehouseId,
    dateFrom,
    dateTo,
  });

  // Client-side filters (search + product + location)
  const filtered = (allRows ?? []).filter((row) => {
    if (search) {
      const s = search.toLowerCase();
      const matchRef = row.reference_no?.toLowerCase().includes(s);
      const matchPartner = row.partner?.name?.toLowerCase().includes(s);
      if (!matchRef && !matchPartner) return false;
    }
    if (productId) {
      if (row.line?.product_id !== Number(productId)) return false;
    }
    if (locationId) {
      const locId = Number(locationId);
      if (
        row.source_location_id !== locId &&
        row.destination_location_id !== locId
      )
        return false;
    }
    return true;
  });

  // Pagination
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasActiveFilters =
    opType !== "ALL" || !!productId || !!locationId || !!warehouseId || !!dateFrom || !!dateTo;

  function clearFilters() {
    setOpType("ALL");
    setProductId("");
    setLocationId("");
    setWarehouseId("");
    setDateFrom("");
    setDateTo("");
    navigate({ to: "/move-history", search: { view: currentView, page: 1 } });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Move History</h1>
            {!isManager && (
              <Badge variant="outline" className="text-xs font-normal">
                Station: {warehouses.data?.find((w) => String(w.id) === effectiveWarehouseId)?.name || "Central Warehouse (WH1)"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Stock movements across all operations — one row per product line.
          </p>
        </div>
        {/* View Toggle — NO New button per §10 clarification #6 */}
        <div className="flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={currentView === "list" ? "secondary" : "ghost"}
            className="rounded-none px-3 gap-1.5"
            id="move-history-list-view"
            onClick={() =>
              navigate({ to: "/move-history", search: { view: "list", page: 1 } })
            }
          >
            <List className="h-4 w-4" />
            List
          </Button>
          <Button
            size="sm"
            variant={currentView === "kanban" ? "secondary" : "ghost"}
            className="rounded-none px-3 gap-1.5"
            id="move-history-kanban-view"
            onClick={() =>
              navigate({ to: "/move-history", search: { view: "kanban", page: 1 } })
            }
          >
            <KanbanSquare className="h-4 w-4" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Search + Quick Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="move-history-search"
              placeholder="Search reference or contact…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={opType} onValueChange={setOpType}>
            <SelectTrigger className="w-44" id="move-history-op-type">
              <SelectValue placeholder="Operation type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="RECEIPT">Receipts</SelectItem>
              <SelectItem value="DELIVERY">Deliveries</SelectItem>
              <SelectItem value="INTERNAL_TRANSFER">Transfers</SelectItem>
              <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showAdvanced || hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5"
            id="move-history-advanced-toggle"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                !
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
            {/* Product */}
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-52" id="filter-product">
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All products</SelectItem>
                {(products.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}{" "}
                    <span className="text-muted-foreground text-xs">[{p.sku}]</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location */}
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-48" id="filter-location">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All locations</SelectItem>
                {(locations.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Warehouse (Manager Only) */}
            {isManager && (
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="w-44" id="filter-warehouse">
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All warehouses</SelectItem>
                  {(warehouses.data ?? []).map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date Range */}
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="w-36"
                value={dateFrom}
                id="filter-date-from"
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="date"
                className="w-36"
                value={dateTo}
                id="filter-date-to"
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[
          { color: "bg-emerald-500", label: "Receipt (stock in)" },
          { color: "bg-destructive", label: "Delivery (stock out)" },
          { color: "bg-blue-500", label: "Transfer" },
          { color: "bg-amber-500", label: "Adjustment" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full inline-block", color)} />
            {label}
          </span>
        ))}
        <span className="ml-auto">{totalRows} row{totalRows !== 1 ? "s" : ""}</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No stock movements found.
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5"
            >
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}
        </div>
      ) : currentView === "list" ? (
        <ListView rows={pageRows} />
      ) : (
        <KanbanView rows={filtered} />
      )}

      {/* Pagination — list view only */}
      {currentView === "list" && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} · {totalRows} rows
          </p>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              className="gap-1"
              onClick={() =>
                navigate({
                  to: "/move-history",
                  search: { view: currentView, page: currentPage - 1 },
                })
              }
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              className="gap-1"
              onClick={() =>
                navigate({
                  to: "/move-history",
                  search: { view: currentView, page: currentPage + 1 },
                })
              }
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={`${row.id}-${row.line?.id ?? idx}`}
              className={cn(
                "hover:bg-accent/30 transition-colors",
                rowBorderColor(row.operation_type as OperationType),
                rowBgColor(row.operation_type as OperationType),
              )}
            >
              <TableCell>
                <Link
                  to="/operations/$type/$id"
                  params={{ type: row.operation_type, id: String(row.id) }}
                  className="font-mono text-sm font-medium hover:underline hover:text-primary transition-colors"
                >
                  {row.reference_no ?? "—"}
                </Link>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {OP_META[row.operation_type as OperationType]?.label}
                </div>
              </TableCell>

              <TableCell>
                {row.line?.product ? (
                  <div>
                    <span className="font-medium text-sm">
                      {row.line.product.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-1.5 font-mono text-[10px]"
                    >
                      {row.line.product.sku}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {row.status === "DONE" && row.validated_date
                  ? new Date(row.validated_date).toLocaleDateString()
                  : row.scheduled_date
                  ? new Date(row.scheduled_date).toLocaleDateString()
                  : "—"}
              </TableCell>

              <TableCell className="text-sm">
                {row.partner?.name ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {row.src?.code ?? row.src?.name ?? "—"}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {row.dst?.code ?? row.dst?.name ?? "—"}
              </TableCell>

              <TableCell
                className={cn(
                  "text-right font-mono",
                  qtyTextColor(row.operation_type as OperationType),
                )}
              >
                {qtySign(row.operation_type as OperationType)}
                {qtyDisplay(row)}
              </TableCell>

              <TableCell>
                <Badge
                  className={cn(
                    "border-0",
                    STATUS_STYLES[row.status as OperationStatus],
                  )}
                >
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ rows }: { rows: any[] }) {
  const grouped = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: rows.filter((r) => r.status === s) }),
    {} as Record<OperationStatus, any[]>,
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUSES.map((status) => (
        <div key={status} className="flex-shrink-0 w-72">
          <div className="mb-2 flex items-center justify-between px-1">
            <Badge className={cn("border-0", STATUS_STYLES[status])}>
              {status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {grouped[status].length}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[status].length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6 border rounded-lg border-dashed">
                No {status.toLowerCase()} movements
              </p>
            )}
            {grouped[status].map((row, idx) => (
              <KanbanCard
                key={`${row.id}-${row.line?.id ?? idx}`}
                row={row}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanCard({ row }: { row: any }) {
  const opType = row.operation_type as OperationType;
  const borderAccent =
    opType === "RECEIPT"
      ? "border-l-emerald-500"
      : opType === "DELIVERY"
      ? "border-l-destructive"
      : opType === "INTERNAL_TRANSFER"
      ? "border-l-blue-500"
      : "border-l-amber-500";

  return (
    <Link
      to="/operations/$type/$id"
      params={{ type: row.operation_type, id: String(row.id) }}
    >
      <Card
        className={cn(
          "cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all border-l-2",
          borderAccent,
        )}
      >
        <CardHeader className="p-3 pb-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-mono">
              {row.reference_no ?? "—"}
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-normal shrink-0"
            >
              {OP_META[opType]?.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1 text-xs text-muted-foreground space-y-1">
          {row.line?.product && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground truncate">
                {row.line.product.name}
              </span>
              <Badge variant="outline" className="font-mono text-[9px]">
                {row.line.product.sku}
              </Badge>
            </div>
          )}
          {row.partner?.name && <p>{row.partner.name}</p>}
          <div className="flex items-center justify-between pt-0.5">
            <span>
              {row.status === "DONE" && row.validated_date
                ? new Date(row.validated_date).toLocaleDateString()
                : row.scheduled_date
                ? new Date(row.scheduled_date).toLocaleDateString()
                : "—"}
            </span>
            <span
              className={cn(
                "font-mono font-semibold",
                opType === "RECEIPT" &&
                  "text-emerald-600 dark:text-emerald-400",
                opType === "DELIVERY" && "text-destructive",
              )}
            >
              {qtySign(opType)}
              {qtyDisplay(row)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
