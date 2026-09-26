import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  Edit2,
  Filter,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setStock } from "@/lib/stocksense";
import { useIsManager, useProfile, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products & Stock — StockSense" },
      {
        name: "description",
        content: "Manage product catalog, reordering levels, and live warehouse stock.",
      },
      { property: "og:title", content: "Products & Stock — StockSense" },
      {
        property: "og:description",
        content: "Manage product catalog, reordering levels, and live warehouse stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

interface ProductRecord {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: number;
  uom_id: number;
  unit_cost: number;
  description: string | null;
  reorder_min_qty: number;
  reorder_max_qty: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: { name: string } | null;
  units_of_measure?: { name: string; code: string } | null;
}

// ─── Data Queries ────────────────────────────────────────────────────────────

function useProductsList() {
  return useQuery({
    queryKey: ["products-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_categories(name),
          units_of_measure(name, code)
        `)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductRecord[];
    },
  });
}

function useStockQuants() {
  return useQuery({
    queryKey: ["stock-quants-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_quants")
        .select(`
          *,
          products(id, name, sku, unit_cost, units_of_measure(code)),
          locations(id, name, code, warehouse_id, warehouses(id, name, code))
        `)
        .order("product_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useMasterMetadata() {
  const categories = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const uoms = useQuery({
    queryKey: ["uoms-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units_of_measure")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const internalLocations = useQuery({
    queryKey: ["locations-internal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, code, warehouse_id, warehouses(name, code)")
        .eq("is_active", true)
        .eq("location_type", "INTERNAL")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return { categories, uoms, internalLocations };
}

// ─── Main Products & Stock Page ──────────────────────────────────────────────

function ProductsPage() {
  const userId = useSessionUserId();
  const { data: profile } = useProfile(userId);
  const { data: isManager } = useIsManager(userId);

  const [activeTab, setActiveTab] = useState<"products" | "stock">("products");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);

  const { categories, uoms, internalLocations } = useMasterMetadata();

  function handleOpenCreate() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(product: ProductRecord) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Products & Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your product inventory, SKU tracking, reordering levels, and live stock balances.
          </p>
        </div>

        {isManager && (
          <Button onClick={handleOpenCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

      {/* Tabs: Products List vs Stock Sub-View (§6.3) */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "products" | "stock")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full sm:w-64 grid-cols-2">
            <TabsTrigger value="products">Catalog</TabsTrigger>
            <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          </TabsList>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 text-xs h-9"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {activeTab === "products" && (
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.data?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Tab 1: Products Catalog (§3.1) */}
        <TabsContent value="products" className="mt-4">
          <ProductsCatalogTab
            search={search}
            categoryFilter={categoryFilter}
            isManager={!!isManager}
            onEdit={handleOpenEdit}
          />
        </TabsContent>

        {/* Tab 2: Live Stock Sub-Tab (§3.3, §6.3) */}
        <TabsContent value="stock" className="mt-4">
          <StockSubViewTab
            search={search}
            isManager={!!isManager}
            staffWarehouseId={!isManager ? (profile?.warehouse_id ?? 1) : null}
          />
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog (§3.2) */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productToEdit={editingProduct}
        categories={categories.data ?? []}
        uoms={uoms.data ?? []}
        locations={internalLocations.data ?? []}
      />
    </div>
  );
}

// ─── Sub-Tab 1: Products Catalog List (§3.1) ─────────────────────────────────

function ProductsCatalogTab({
  search,
  categoryFilter,
  isManager,
  onEdit,
}: {
  search: string;
  categoryFilter: string;
  isManager: boolean;
  onEdit: (p: ProductRecord) => void;
}) {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useProductsList();

  // Client-side filtering by name, SKU, and category
  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        categoryFilter === "ALL" || String(p.category_id) === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [products, search, categoryFilter]);

  // Soft Delete / Toggle Active (§8 rule 7)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      // Check if product is in active operations before soft deleting
      if (!is_active) {
        const { data: lines, error: lineErr } = await supabase
          .from("stock_operation_lines")
          .select("id, operation:stock_operations(status)")
          .eq("product_id", id)
          .limit(10);

        if (!lineErr && lines) {
          const hasActiveOps = lines.some(
            (l: any) =>
              l.operation &&
              l.operation.status !== "DONE" &&
              l.operation.status !== "CANCELED",
          );
          if (hasActiveOps) {
            throw new Error(
              "Cannot archive product: It is currently referenced in an active/pending operation.",
            );
          }
        }
      }

      const { error } = await supabase
        .from("products")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.is_active ? "Product restored" : "Product archived");
      queryClient.invalidateQueries({ queryKey: ["products-full"] });
      queryClient.invalidateQueries({ queryKey: ["products-simple"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stock-kpis"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update product status");
    },
  });

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-semibold">Product Name</TableHead>
              <TableHead className="font-semibold">SKU</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Unit</TableHead>
              <TableHead className="text-right font-semibold">Unit Cost</TableHead>
              <TableHead className="text-right font-semibold">Reorder Min</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              {isManager && <TableHead className="text-right font-semibold">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  {isManager && <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 8 : 7} className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <p className="font-medium">No products match your criteria.</p>
                  <p className="text-xs mt-1">Try changing your search term or category filter.</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    "transition-colors",
                    !p.is_active && "opacity-60 bg-muted/20",
                  )}
                >
                  {/* Name + Barcode preview */}
                  <TableCell>
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.barcode && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Barcode: {p.barcode}
                      </span>
                    )}
                  </TableCell>

                  {/* SKU Tag (§3.1: [DESK001] style tag) */}
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                      [{p.sku}]
                    </Badge>
                  </TableCell>

                  {/* Category */}
                  <TableCell className="text-sm">
                    {p.product_categories?.name || "Uncategorized"}
                  </TableCell>

                  {/* Unit of Measure */}
                  <TableCell className="text-sm">
                    {p.units_of_measure?.code || p.units_of_measure?.name || "pcs"}
                  </TableCell>

                  {/* Unit Cost */}
                  <TableCell className="text-right font-medium">
                    ${Number(p.unit_cost).toFixed(2)}
                  </TableCell>

                  {/* Reorder Min Qty */}
                  <TableCell className="text-right">
                    <span className="font-medium">{Number(p.reorder_min_qty)}</span>
                    {p.reorder_max_qty !== null && (
                      <span className="text-xs text-muted-foreground ml-1">
                        / {Number(p.reorder_max_qty)} max
                      </span>
                    )}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge
                      variant={p.is_active ? "secondary" : "outline"}
                      className={cn(
                        "text-[11px]",
                        p.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "text-muted-foreground",
                      )}
                    >
                      {p.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>

                  {/* Actions (Manager only) */}
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Edit Product"
                          onClick={() => onEdit(p)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 px-2 text-xs",
                            p.is_active
                              ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                              : "text-primary hover:bg-primary/10",
                          )}
                          disabled={toggleActiveMutation.isPending}
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: p.id,
                              is_active: !p.is_active,
                            })
                          }
                        >
                          {p.is_active ? "Archive" : "Restore"}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ─── Sub-Tab 2: Stock Sub-View (§3.3, §6.3) ──────────────────────────────────

function StockSubViewTab({
  search,
  isManager,
  staffWarehouseId,
}: {
  search: string;
  isManager: boolean;
  staffWarehouseId?: number | null | undefined;
}) {
  const queryClient = useQueryClient();
  const { data: stockQuants, isLoading } = useStockQuants();

  // Temporary state for inline editable on-hand cells
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  // Filter stock rows by product name, SKU, and scope by warehouse for staff
  const filteredRows = useMemo(() => {
    return (stockQuants ?? []).filter((r: any) => {
      if (!isManager && staffWarehouseId && r.locations?.warehouse_id !== staffWarehouseId) {
        return false;
      }
      const pName = r.products?.name?.toLowerCase() ?? "";
      const pSku = r.products?.sku?.toLowerCase() ?? "";
      const locName = r.locations?.name?.toLowerCase() ?? "";
      const whName = r.locations?.warehouses?.name?.toLowerCase() ?? "";
      const q = search.toLowerCase();

      return (
        pName.includes(q) ||
        pSku.includes(q) ||
        locName.includes(q) ||
        whName.includes(q)
      );
    });
  }, [stockQuants, search, isManager, staffWarehouseId]);

  // Total stock summary metrics
  const summary = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;

    for (const r of filteredRows) {
      totalOnHand += Number(r.quantity) || 0;
      totalReserved += Number(r.reserved_quantity) || 0;
    }

    return {
      totalOnHand,
      totalReserved,
      totalFree: totalOnHand - totalReserved,
    };
  }, [filteredRows]);

  // Save inline adjustment via set_stock RPC (§6.3, §8 rule 5)
  // NEVER write to stock_quants directly!
  const saveAdjustmentMutation = useMutation({
    mutationFn: async (row: {
      quantId: number;
      productId: number;
      locationId: number;
      counted: number;
    }) => {
      setSavingRowId(row.quantId);
      await setStock(row.productId, row.locationId, row.counted);
    },
    onSuccess: (_, vars) => {
      toast.success("Stock updated — logged as stock adjustment in ledger");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[vars.quantId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["stock-quants-full"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stock-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-operations"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    },
    onSettled: () => setSavingRowId(null),
  });

  return (
    <div className="space-y-4">
      {/* Quick Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-card p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium">
              Total On Hand
            </p>
            <p className="text-xl font-bold text-foreground">
              {summary.totalOnHand.toLocaleString()}
            </p>
          </div>
          <Boxes className="h-5 w-5 text-primary opacity-60" />
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium">
              Reserved for Outgoing
            </p>
            <p className="text-xl font-bold text-amber-500">
              {summary.totalReserved.toLocaleString()}
            </p>
          </div>
          <Tag className="h-5 w-5 text-amber-500 opacity-60" />
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium">
              Free to Use
            </p>
            <p className="text-xl font-bold text-emerald-500">
              {summary.totalFree.toLocaleString()}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500 opacity-60" />
        </div>
      </div>

      {/* Stock Levels Table (§6.3) */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold">Warehouse / Location</TableHead>
                <TableHead className="text-right font-semibold">Per Unit Cost</TableHead>
                <TableHead className="text-right font-semibold">On Hand</TableHead>
                <TableHead className="text-right font-semibold">Reserved</TableHead>
                <TableHead className="text-right font-semibold">Free to Use</TableHead>
                <TableHead className="w-52 text-right font-semibold">
                  Update Stock (Adjust)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Boxes className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="font-medium">No stock records found.</p>
                    <p className="text-xs mt-1">
                      Validate incoming receipts or create an initial adjustment to seed warehouse stock.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((r: any) => {
                  const onHand = Number(r.quantity) || 0;
                  const reserved = Number(r.reserved_quantity) || 0;
                  const free = onHand - reserved;
                  const unitCost = Number(r.products?.unit_cost) || 0;

                  const editValue = edits[r.id];
                  const dirty =
                    editValue !== undefined && editValue !== String(onHand);

                  const diff = dirty
                    ? Number(editValue || 0) - onHand
                    : 0;

                  return (
                    <TableRow key={r.id} className="transition-colors">
                      {/* Product Name + SKU Tag */}
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {r.products?.name}
                        </p>
                        <Badge variant="outline" className="font-mono text-[10px] mt-0.5">
                          [{r.products?.sku}]
                        </Badge>
                      </TableCell>

                      {/* Location & Warehouse */}
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {r.locations?.warehouses?.code
                            ? `${r.locations.warehouses.code} / ${r.locations.name}`
                            : r.locations?.name}
                        </span>
                        {r.locations?.code && (
                          <span className="text-[11px] text-muted-foreground block font-mono">
                            code: {r.locations.code}
                          </span>
                        )}
                      </TableCell>

                      {/* Per Unit Cost */}
                      <TableCell className="text-right font-medium">
                        ${unitCost.toFixed(2)}
                      </TableCell>

                      {/* On Hand (Live Quants) */}
                      <TableCell className="text-right font-bold text-foreground">
                        {onHand} {r.products?.units_of_measure?.code || ""}
                      </TableCell>

                      {/* Reserved Quantity */}
                      <TableCell className="text-right text-amber-500 font-medium">
                        {reserved > 0 ? reserved : "0"}
                      </TableCell>

                      {/* Free to Use (§6.3 computed: quantity - reserved) */}
                      <TableCell className="text-right font-bold text-emerald-500">
                        {free}
                      </TableCell>

                      {/* Inline Editable Cell (§6.3) */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className={cn(
                                "h-8 w-24 text-right text-xs font-mono font-medium",
                                dirty && "border-primary ring-1 ring-primary/40",
                              )}
                              value={editValue ?? String(onHand)}
                              onChange={(e) =>
                                setEdits((s) => ({
                                  ...s,
                                  [r.id]: e.target.value,
                                }))
                              }
                            />
                            {dirty && (
                              <span
                                className={cn(
                                  "absolute -top-3 right-1 text-[10px] font-bold px-1 rounded",
                                  diff > 0
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    : "bg-destructive/20 text-destructive",
                                )}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant={dirty ? "default" : "secondary"}
                            className="h-8 text-xs px-2.5 font-medium"
                            disabled={
                              !dirty ||
                              savingRowId === r.id ||
                              saveAdjustmentMutation.isPending
                            }
                            onClick={() =>
                              saveAdjustmentMutation.mutate({
                                quantId: r.id,
                                productId: r.product_id,
                                locationId: r.location_id,
                                counted: Number(editValue),
                              })
                            }
                          >
                            {savingRowId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ─── Add / Edit Product Dialog (§3.2) ────────────────────────────────────────

function ProductDialog({
  open,
  onOpenChange,
  productToEdit,
  categories,
  uoms,
  locations,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productToEdit: ProductRecord | null;
  categories: { id: number; name: string }[];
  uoms: { id: number; name: string; code: string }[];
  locations: { id: number; name: string; code: string; warehouses?: { name: string; code: string } | null }[];
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(productToEdit);

  // Form Fields (§3.2, §4.2)
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uomId, setUomId] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [description, setDescription] = useState("");
  const [reorderMin, setReorderMin] = useState("0");
  const [reorderMax, setReorderMax] = useState("");

  // Optional Initial Stock fields (Only on creation per §3.2, §4.2)
  const [initialStockQty, setInitialStockQty] = useState("");
  const [initialStockLocationId, setInitialStockLocationId] = useState("");

  const [busy, setBusy] = useState(false);

  // Reset or initialize state when dialog opens or productToEdit changes
  useMemo(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode ?? "");
      setCategoryId(String(productToEdit.category_id));
      setUomId(String(productToEdit.uom_id));
      setUnitCost(String(productToEdit.unit_cost));
      setDescription(productToEdit.description ?? "");
      setReorderMin(String(productToEdit.reorder_min_qty));
      setReorderMax(
        productToEdit.reorder_max_qty !== null
          ? String(productToEdit.reorder_max_qty)
          : "",
      );
      setInitialStockQty("");
      setInitialStockLocationId("");
    } else {
      setName("");
      setSku("");
      setBarcode("");
      setCategoryId("");
      setUomId("");
      setUnitCost("0");
      setDescription("");
      setReorderMin("0");
      setReorderMax("");
      setInitialStockQty("");
      setInitialStockLocationId("");
    }
  }, [productToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedSku = sku.trim();
    const catIdNum = Number(categoryId);
    const uomIdNum = Number(uomId);

    if (!trimmedName || !trimmedSku || !catIdNum || !uomIdNum) {
      toast.error("Please fill in all required fields (Name, SKU, Category, UoM)");
      return;
    }

    const initQtyNum = Number(initialStockQty);
    if (initQtyNum > 0 && !initialStockLocationId) {
      toast.error("Please select a storage location for the initial stock");
      return;
    }

    setBusy(true);
    try {
      if (isEditing && productToEdit) {
        // Update Product (§7: PUT /products/{id})
        const { error } = await supabase
          .from("products")
          .update({
            name: trimmedName,
            sku: trimmedSku,
            barcode: barcode.trim() || null,
            category_id: catIdNum,
            uom_id: uomIdNum,
            unit_cost: Number(unitCost) || 0,
            description: description.trim() || null,
            reorder_min_qty: Number(reorderMin) || 0,
            reorder_max_qty: reorderMax ? Number(reorderMax) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", productToEdit.id);

        if (error) throw error;
        toast.success(`Product "${trimmedName}" updated successfully`);
      } else {
        // Create Product (§7: POST /products)
        const { data: newProd, error } = await supabase
          .from("products")
          .insert({
            name: trimmedName,
            sku: trimmedSku,
            barcode: barcode.trim() || null,
            category_id: catIdNum,
            uom_id: uomIdNum,
            unit_cost: Number(unitCost) || 0,
            description: description.trim() || null,
            reorder_min_qty: Number(reorderMin) || 0,
            reorder_max_qty: reorderMax ? Number(reorderMax) : null,
          })
          .select("id")
          .single();

        if (error) throw error;

        // If Initial Stock was provided, log adjustment opening balance (§4.2, §7)
        if (initQtyNum > 0 && initialStockLocationId && newProd) {
          await setStock(newProd.id, Number(initialStockLocationId), initQtyNum);
          toast.success(
            `Product created with opening balance of ${initQtyNum} units`,
          );
        } else {
          toast.success(`Product "${trimmedName}" created successfully`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["products-full"] });
      queryClient.invalidateQueries({ queryKey: ["products-simple"] });
      queryClient.invalidateQueries({ queryKey: ["stock-quants-full"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stock-kpis"] });

      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save product",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {isEditing ? "Edit Product" : "New Product"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update product specifications and reorder parameters."
              : "Register a new SKU and define measurement units and reorder thresholds."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Row 1: Name and SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name" className="text-xs font-medium">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Steel Rod 10mm"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-sku" className="text-xs font-medium">
                SKU / Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. STL-ROD-010"
                className="text-xs font-mono font-semibold"
                required
              />
            </div>
          </div>

          {/* Row 2: Barcode & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-barcode" className="text-xs font-medium">
                Barcode (optional)
              </Label>
              <Input
                id="prod-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 8901234567890"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-cat" className="text-xs font-medium">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="prod-cat" className="text-xs h-9">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Unit of Measure & Unit Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-uom" className="text-xs font-medium">
                Unit of Measure <span className="text-destructive">*</span>
              </Label>
              <Select value={uomId} onValueChange={setUomId}>
                <SelectTrigger id="prod-uom" className="text-xs h-9">
                  <SelectValue placeholder="Select Unit" />
                </SelectTrigger>
                <SelectContent>
                  {uoms.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-cost" className="text-xs font-medium">
                Per Unit Cost ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-cost"
                type="number"
                min={0}
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="text-xs"
                required
              />
            </div>
          </div>

          {/* Row 4: Reorder Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-min" className="text-xs font-medium">
                Reorder Min Qty <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-min"
                type="number"
                min={0}
                step="any"
                value={reorderMin}
                onChange={(e) => setReorderMin(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-max" className="text-xs font-medium">
                Reorder Max Qty (optional)
              </Label>
              <Input
                id="prod-max"
                type="number"
                min={0}
                step="any"
                value={reorderMax}
                onChange={(e) => setReorderMax(e.target.value)}
                placeholder="No maximum"
                className="text-xs"
              />
            </div>
          </div>

          {/* Optional Opening Stock Balance (Creation Only per §4.2, §7) */}
          {!isEditing && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-primary" />
                Initial Stock Opening Balance (Optional)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="init-qty" className="text-[11px] text-muted-foreground">
                    Initial Quantity
                  </Label>
                  <Input
                    id="init-qty"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={initialStockQty}
                    onChange={(e) => setInitialStockQty(e.target.value)}
                    className="text-xs bg-background h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="init-loc" className="text-[11px] text-muted-foreground">
                    Storage Location
                  </Label>
                  <Select
                    value={initialStockLocationId}
                    onValueChange={setInitialStockLocationId}
                  >
                    <SelectTrigger id="init-loc" className="text-xs bg-background h-8">
                      <SelectValue placeholder="Choose Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={String(loc.id)}>
                          {loc.warehouses?.code ? `${loc.warehouses.code} / ` : ""}
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-desc" className="text-xs font-medium">
              Description (optional)
            </Label>
            <Textarea
              id="prod-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional specifications or handling notes..."
              rows={2}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                !name.trim() ||
                !sku.trim() ||
                !categoryId ||
                !uomId ||
                busy
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
