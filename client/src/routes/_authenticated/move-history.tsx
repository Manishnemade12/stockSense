import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_STYLES,
  OP_META,
  type OperationType,
  type OperationStatus,
} from "@/lib/stocksense";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/move-history")({
  head: () => ({
    meta: [
      { title: "Move History — StockSense" },
      { name: "description", content: "Full stock movement history." },
    ],
  }),
  component: MoveHistoryPage,
});

// Per TDD §6.8: Move History is NOT a plain ledger dump.
// It shows stock_operations joined to lines so status can be live from parent op.
// Green = RECEIPT (in), Red = DELIVERY (out), neutral = TRANSFER/ADJUSTMENT

function useMoveHistory(filters: {
  search: string;
  opType: string;
  dateFrom: string;
  dateTo: string;
}) {
  return useQuery({
    queryKey: ["move-history", filters],
    queryFn: async () => {
      // One row per product line — join operations → lines → products/locations/partners
      let q = supabase
        .from("stock_operations")
        .select(`
          id, reference_no, operation_type, status,
          scheduled_date, validated_date, partner_id,
          source_location_id, destination_location_id,
          partner:partners(id,name),
          src:locations!stock_operations_source_location_id_fkey(id,name,code),
          dst:locations!stock_operations_destination_location_id_fkey(id,name,code),
          stock_operation_lines(
            id, product_id, quantity_planned, quantity_done,
            product:products(id,name,sku)
          ),
          stock_adjustment_lines(
            id, product_id, counted_quantity,
            product:products(id,name,sku)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filters.opType && filters.opType !== "ALL") {
        q = q.eq("operation_type", filters.opType as OperationType);
      }
      if (filters.dateFrom) {
        q = q.gte("scheduled_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        q = q.lte("scheduled_date", filters.dateTo + "T23:59:59Z");
      }

      const { data, error } = await q;
      if (error) throw error;

      // Expand: one row per product line per operation
      const rows: any[] = [];
      for (const op of data ?? []) {
        const lines =
          op.stock_operation_lines?.length > 0
            ? op.stock_operation_lines
            : op.stock_adjustment_lines ?? [];

        if (lines.length === 0) {
          rows.push({ ...op, line: null });
        } else {
          for (const line of lines) {
            rows.push({ ...op, line });
          }
        }
      }
      return rows;
    },
  });
}

function MoveHistoryPage() {
  const [search, setSearch] = useState("");
  const [opTypeFilter, setOpTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: rows, isLoading } = useMoveHistory({
    search,
    opType: opTypeFilter,
    dateFrom,
    dateTo,
  });

  // Client-side search filter (reference_no OR partner name)
  const filtered = (rows ?? []).filter((row) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      row.reference_no?.toLowerCase().includes(s) ||
      row.partner?.name?.toLowerCase().includes(s)
    );
  });

  function rowColor(opType: OperationType) {
    if (opType === "RECEIPT") return "border-l-2 border-l-emerald-500";
    if (opType === "DELIVERY") return "border-l-2 border-l-destructive";
    if (opType === "INTERNAL_TRANSFER") return "border-l-2 border-l-blue-500";
    return "border-l-2 border-l-amber-500";
  }

  function qty(row: any): string {
    if (!row.line) return "—";
    if (row.status === "DONE") {
      // Use quantity_done or counted_quantity (whichever exists)
      const q = row.line.quantity_done ?? row.line.counted_quantity;
      return q != null ? Number(q).toLocaleString() : "—";
    }
    return row.line.quantity_planned != null
      ? Number(row.line.quantity_planned).toLocaleString()
      : "—";
  }

  function qtyColor(opType: OperationType) {
    if (opType === "RECEIPT") return "text-emerald-600 dark:text-emerald-400 font-semibold";
    if (opType === "DELIVERY") return "text-destructive font-semibold";
    return "";
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Move History</h1>
        <p className="text-sm text-muted-foreground">
          All stock movements — green = in, red = out.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reference or contact…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={opTypeFilter} onValueChange={setOpTypeFilter}>
          <SelectTrigger className="w-44">
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

        <Input
          type="date"
          className="w-36"
          placeholder="Date from"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          className="w-36"
          placeholder="Date to"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          Receipt (stock in)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
          Delivery (stock out)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          Transfer
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
          Adjustment
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No stock movements found.
        </p>
      ) : (
        <div className="rounded-lg border">
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
              {filtered.map((row, idx) => (
                <TableRow
                  key={`${row.id}-${row.line?.id ?? idx}`}
                  className={cn("hover:bg-accent/30", rowColor(row.operation_type))}
                >
                  <TableCell>
                    <Link
                      to="/operations/$type/$id"
                      params={{
                        type: row.operation_type,
                        id: String(row.id),
                      }}
                      className="font-mono text-sm font-medium hover:underline"
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
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.status === "DONE" && row.validated_date
                      ? new Date(row.validated_date).toLocaleDateString()
                      : row.scheduled_date
                      ? new Date(row.scheduled_date).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.partner?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.src?.code ?? row.src?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.dst?.code ?? row.dst?.name ?? "—"}
                  </TableCell>
                  <TableCell className={cn("text-right", qtyColor(row.operation_type))}>
                    {qty(row)}
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
      )}
    </div>
  );
}
