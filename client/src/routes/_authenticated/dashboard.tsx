import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Layers,
  PackageCheck,
  PackageOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Warehouse,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_STYLES, type OperationType, type OperationStatus } from "@/lib/stocksense";
import { useProfile, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StockSense" },
      {
        name: "description",
        content: "StockSense inventory overview and real-time operations dashboard.",
      },
      { property: "og:title", content: "Dashboard — StockSense" },
      {
        property: "og:description",
        content: "StockSense inventory overview and real-time operations dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

// Helper: determine if an operation is late per §5 & §6.2
function isOpLate(op: { scheduled_date: string; status: string }) {
  return (
    new Date(op.scheduled_date) < new Date() &&
    op.status !== "DONE" &&
    op.status !== "CANCELED"
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const userId = useSessionUserId();
  const { data: profile } = useProfile(userId);

  // Warehouse scoping filter (all or specific warehouse)
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");

  // 1. Fetch Warehouses for dropdown
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch All Operations for KPI formulas and summary cards
  const {
    data: operations,
    isLoading: opsLoading,
    refetch: refetchOps,
  } = useQuery({
    queryKey: ["dashboard-operations", warehouseFilter],
    queryFn: async () => {
      let query = supabase
        .from("stock_operations")
        .select(`
          id,
          reference_no,
          operation_type,
          status,
          scheduled_date,
          warehouse_id,
          created_at,
          partner:partners(id, name),
          src:locations!stock_operations_source_location_id_fkey(name, code),
          dst:locations!stock_operations_destination_location_id_fkey(name, code)
        `)
        .order("created_at", { ascending: false });

      if (warehouseFilter !== "ALL") {
        query = query.eq("warehouse_id", Number(warehouseFilter));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // 3. Fetch Products and Stock Quants for inventory KPIs
  const {
    data: stockData,
    isLoading: stockLoading,
    refetch: refetchStock,
  } = useQuery({
    queryKey: ["dashboard-stock-kpis", warehouseFilter],
    queryFn: async () => {
      // Products
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, name, sku, reorder_min_qty, is_active")
        .eq("is_active", true);
      if (pErr) throw pErr;

      // Quants (with location to filter by warehouse if needed)
      let quantsQuery = supabase
        .from("stock_quants")
        .select("product_id, quantity, reserved_quantity, location:locations(warehouse_id)");

      const { data: quants, error: qErr } = await quantsQuery;
      if (qErr) throw qErr;

      // Filter quants by warehouse if selected
      const filteredQuants =
        warehouseFilter === "ALL"
          ? quants
          : quants.filter(
              (q: any) =>
                q.location &&
                String(q.location.warehouse_id) === String(warehouseFilter),
            );

      // Quantities per product
      const productQtyMap = new Map<number, { onHand: number; reserved: number }>();
      let totalOnHand = 0;
      let totalReserved = 0;

      for (const q of filteredQuants) {
        const pId = q.product_id;
        const current = productQtyMap.get(pId) || { onHand: 0, reserved: 0 };
        const qOnHand = Number(q.quantity) || 0;
        const qReserved = Number(q.reserved_quantity) || 0;

        current.onHand += qOnHand;
        current.reserved += qReserved;
        productQtyMap.set(pId, current);

        totalOnHand += qOnHand;
        totalReserved += qReserved;
      }

      // Calculations (§6.2 formulas)
      const totalProducts = products.length;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const p of products) {
        const qty = productQtyMap.get(p.id)?.onHand ?? 0;
        const minQty = Number(p.reorder_min_qty) || 0;

        if (qty === 0) {
          outOfStockCount++;
        } else if (qty <= minQty) {
          lowStockCount++;
        }
      }

      return {
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalOnHand,
        totalReserved,
        freeToUse: totalOnHand - totalReserved,
      };
    },
  });

  // Calculate Receipt Card Metrics (§6.2)
  const receiptsMetrics = useMemo(() => {
    const emptyStatus: Record<string, number> = { DRAFT: 0, WAITING: 0, READY: 0, DONE: 0 };
    if (!operations) return { late: 0, totalActive: 0, readyCount: 0, byStatus: emptyStatus, recent: [] };

    const rcpts = operations.filter((o) => o.operation_type === "RECEIPT");
    const late = rcpts.filter(isOpLate).length;
    const totalActive = rcpts.filter(
      (o) => o.status !== "DONE" && o.status !== "CANCELED",
    ).length;
    const readyCount = rcpts.filter((o) => o.status === "READY").length;

    const byStatus: Record<string, number> = {
      DRAFT: rcpts.filter((o) => o.status === "DRAFT").length,
      WAITING: rcpts.filter((o) => o.status === "WAITING").length,
      READY: readyCount,
      DONE: rcpts.filter((o) => o.status === "DONE").length,
    };

    return {
      late,
      totalActive,
      readyCount,
      byStatus,
      recent: rcpts.slice(0, 4),
    };
  }, [operations]);

  // Calculate Delivery Card Metrics (§6.2)
  const deliveriesMetrics = useMemo(() => {
    const emptyStatus: Record<string, number> = { DRAFT: 0, WAITING: 0, READY: 0, DONE: 0 };
    if (!operations) return { late: 0, waiting: 0, totalActive: 0, readyCount: 0, byStatus: emptyStatus, recent: [] };

    const delivs = operations.filter((o) => o.operation_type === "DELIVERY");
    const late = delivs.filter(isOpLate).length;
    const waiting = delivs.filter((o) => o.status === "WAITING").length;
    const totalActive = delivs.filter(
      (o) => o.status !== "DONE" && o.status !== "CANCELED",
    ).length;
    const readyCount = delivs.filter((o) => o.status === "READY").length;

    const byStatus: Record<string, number> = {
      DRAFT: delivs.filter((o) => o.status === "DRAFT").length,
      WAITING: waiting,
      READY: readyCount,
      DONE: delivs.filter((o) => o.status === "DONE").length,
    };

    return {
      late,
      waiting,
      totalActive,
      readyCount,
      byStatus,
      recent: delivs.slice(0, 4),
    };
  }, [operations]);

  // Internal Transfers Scheduled (§6.2)
  const transfersScheduled = useMemo(() => {
    if (!operations) return 0;
    return operations.filter(
      (o) =>
        o.operation_type === "INTERNAL_TRANSFER" &&
        o.status !== "DONE" &&
        o.status !== "CANCELED",
    ).length;
  }, [operations]);

  const isLoading = opsLoading || stockLoading;

  return (
    <div className="space-y-6">
      {/* Top Header & Warehouse Scoping */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Inventory Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Live overview of warehouse stock, pending movements, and operational metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Warehouse filter dropdown */}
          <div className="flex items-center gap-1.5">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <Select
              value={warehouseFilter}
              onValueChange={setWarehouseFilter}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Warehouses</SelectItem>
                {warehouses?.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {wh.name} ({wh.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Refresh metrics"
            onClick={() => {
              refetchOps();
              refetchStock();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── 4 Core Formula Stat KPI Cards (§6.2) ─────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Products */}
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium">
              Total Products
            </CardDescription>
            <Boxes className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-foreground">
                  {stockData?.totalProducts ?? 0}
                </p>
                <Link
                  to="/products"
                  className="text-xs text-primary hover:underline"
                >
                  View catalog →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Low Stock Count */}
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium">
              Low Stock Items
            </CardDescription>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (stockData?.lowStockCount ?? 0) > 0
                      ? "text-amber-500"
                      : "text-foreground",
                  )}
                >
                  {stockData?.lowStockCount ?? 0}
                </p>
                <span className="text-xs text-muted-foreground">
                  Below reorder min
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Out of Stock Count */}
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium">
              Out of Stock
            </CardDescription>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (stockData?.outOfStockCount ?? 0) > 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {stockData?.outOfStockCount ?? 0}
                </p>
                <span className="text-xs text-muted-foreground">
                  Zero on-hand qty
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Transfers Scheduled */}
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="text-xs font-medium">
              Transfers Scheduled
            </CardDescription>
            <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-foreground">
                  {transfersScheduled}
                </p>
                <Link
                  to="/operations/$type"
                  params={{ type: "INTERNAL_TRANSFER" }}
                  className="text-xs text-primary hover:underline"
                >
                  View transfers →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Live Stock Summary Strip ────────────────────────────────────── */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border/60 text-center">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total On Hand
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {isLoading ? (
                <Skeleton className="mx-auto h-7 w-20" />
              ) : (
                stockData?.totalOnHand?.toLocaleString() ?? 0
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Reserved for Outgoing
            </p>
            <p className="mt-1 text-xl font-bold text-amber-500">
              {isLoading ? (
                <Skeleton className="mx-auto h-7 w-20" />
              ) : (
                stockData?.totalReserved?.toLocaleString() ?? 0
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Free to Use
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-500">
              {isLoading ? (
                <Skeleton className="mx-auto h-7 w-20" />
              ) : (
                stockData?.freeToUse?.toLocaleString() ?? 0
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Two Mockup Operation Cards (Receipts & Deliveries - §6.2) ───── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ================================================================ */}
        {/* CARD 1: RECEIPTS (§6.2: X Late, Y operations, Button N to receive)*/}
        {/* ================================================================ */}
        <Card className="flex flex-col border-border/80 shadow-md">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
                  <PackageOpen className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Receipts</CardTitle>
                  <CardDescription className="text-xs">
                    Incoming stock movements from vendors & suppliers
                  </CardDescription>
                </div>
              </div>

              <Link
                to="/operations/$type"
                params={{ type: "RECEIPT" }}
              >
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* Sub-metrics bar per §6.2: "X Late" · "Y operations" · Button "N to receive" */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 p-2.5">
              <div className="flex items-center gap-3 text-xs">
                {receiptsMetrics.late > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-destructive">
                    <Clock className="h-3.5 w-3.5" />
                    {receiptsMetrics.late} Late
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    0 Late
                  </span>
                )}
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-foreground">
                  {receiptsMetrics.totalActive} operations
                </span>
              </div>

              {/* Action Button: "N to receive" (filters to status=READY) */}
              <Link
                to="/operations/$type"
                params={{ type: "RECEIPT" }}
                search={{ status: "READY" }}
              >
                <Button
                  size="sm"
                  className="h-8 font-medium gap-1.5 shadow-sm"
                >
                  <PackageOpen className="h-3.5 w-3.5" />
                  {receiptsMetrics.readyCount} to receive
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pt-4 space-y-4">
            {/* Status breakdown grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["DRAFT", "READY", "DONE"] as const).map((st) => (
                <div key={st} className="rounded-lg border bg-card p-2">
                  <p className="text-lg font-bold text-foreground">
                    {receiptsMetrics.byStatus[st] ?? 0}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {st.toLowerCase()}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border bg-card p-2">
                <p className="text-lg font-bold text-destructive">
                  {receiptsMetrics.late}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-destructive">
                  late
                </p>
              </div>
            </div>

            {/* Latest operations list */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Receipts
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : receiptsMetrics.recent.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No receipts recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {receiptsMetrics.recent.map((op: any) => {
                    const late = isOpLate(op);
                    return (
                      <Link
                        key={op.id}
                        to="/operations/$type/$id"
                        params={{ type: "RECEIPT", id: String(op.id) }}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs transition-colors hover:bg-accent/60"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {op.reference_no}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {op.partner?.name || "Direct Vendor"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {late && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-5 px-1.5"
                            >
                              Late
                            </Badge>
                          )}
                          <Badge
                            className={cn(
                              "border-0 text-[10px] h-5",
                              STATUS_STYLES[op.status as OperationStatus],
                            )}
                          >
                            {op.status}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* CARD 2: DELIVERIES (§6.2: X Late, Y waiting, Z operations, Button N to Deliver) */}
        {/* ================================================================ */}
        <Card className="flex flex-col border-border/80 shadow-md">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
                  <PackageCheck className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Deliveries</CardTitle>
                  <CardDescription className="text-xs">
                    Outgoing shipments and customer order fulfillment
                  </CardDescription>
                </div>
              </div>

              <Link
                to="/operations/$type"
                params={{ type: "DELIVERY" }}
              >
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* Sub-metrics bar per §6.2: "X Late" · "Y waiting" · "Z operations" · Button "N to Deliver" */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 p-2.5">
              <div className="flex items-center gap-2.5 text-xs">
                {deliveriesMetrics.late > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-destructive">
                    <Clock className="h-3.5 w-3.5" />
                    {deliveriesMetrics.late} Late
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    0 Late
                  </span>
                )}
                <span className="text-muted-foreground">•</span>
                {deliveriesMetrics.waiting > 0 ? (
                  <span className="flex items-center gap-1 font-medium text-amber-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {deliveriesMetrics.waiting} waiting
                  </span>
                ) : (
                  <span className="text-muted-foreground">0 waiting</span>
                )}
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-foreground">
                  {deliveriesMetrics.totalActive} operations
                </span>
              </div>

              {/* Action Button: "N to Deliver" (filters to status=READY) */}
              <Link
                to="/operations/$type"
                params={{ type: "DELIVERY" }}
                search={{ status: "READY" }}
              >
                <Button
                  size="sm"
                  className="h-8 font-medium gap-1.5 shadow-sm"
                >
                  <PackageCheck className="h-3.5 w-3.5" />
                  {deliveriesMetrics.readyCount} to Deliver
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="flex-1 pt-4 space-y-4">
            {/* Status breakdown grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["DRAFT", "WAITING", "READY", "DONE"] as const).map((st) => (
                <div key={st} className="rounded-lg border bg-card p-2">
                  <p
                    className={cn(
                      "text-lg font-bold",
                      st === "WAITING" &&
                        (deliveriesMetrics.byStatus[st] ?? 0) > 0
                        ? "text-amber-500"
                        : "text-foreground",
                    )}
                  >
                    {deliveriesMetrics.byStatus[st] ?? 0}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {st.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>

            {/* Latest operations list */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Deliveries
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : deliveriesMetrics.recent.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No deliveries recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {deliveriesMetrics.recent.map((op: any) => {
                    const late = isOpLate(op);
                    return (
                      <Link
                        key={op.id}
                        to="/operations/$type/$id"
                        params={{ type: "DELIVERY", id: String(op.id) }}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs transition-colors hover:bg-accent/60"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {op.reference_no}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {op.partner?.name || "Customer Shipment"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {late && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-5 px-1.5"
                            >
                              Late
                            </Badge>
                          )}
                          <Badge
                            className={cn(
                              "border-0 text-[10px] h-5",
                              STATUS_STYLES[op.status as OperationStatus],
                            )}
                          >
                            {op.status}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick Actions & Shortcuts ───────────────────────────────────── */}
      <Card className="border-border/60 bg-card/40 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          <CardDescription className="text-xs">
            Frequently performed warehouse tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              to="/operations/$type"
              params={{ type: "RECEIPT" }}
              className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-xs font-medium transition-all hover:bg-accent hover:border-primary/40"
            >
              <PackageOpen className="h-4 w-4 text-primary" />
              <span>New Receipt</span>
            </Link>
            <Link
              to="/operations/$type"
              params={{ type: "DELIVERY" }}
              className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-xs font-medium transition-all hover:bg-accent hover:border-primary/40"
            >
              <PackageCheck className="h-4 w-4 text-primary" />
              <span>New Delivery</span>
            </Link>
            <Link
              to="/operations/$type"
              params={{ type: "INTERNAL_TRANSFER" }}
              className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-xs font-medium transition-all hover:bg-accent hover:border-primary/40"
            >
              <ArrowLeftRight className="h-4 w-4 text-blue-500" />
              <span>Internal Transfer</span>
            </Link>
            <Link
              to="/operations/$type"
              params={{ type: "ADJUSTMENT" }}
              className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-xs font-medium transition-all hover:bg-accent hover:border-primary/40"
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
              <span>Stock Adjustment</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
