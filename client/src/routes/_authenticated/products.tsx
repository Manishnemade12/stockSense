import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setStock } from "@/lib/stocksense";
import { useIsManager, useSessionUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — StockSense" },
      { name: "description", content: "Manage products and stock levels." },
      { property: "og:title", content: "Products — StockSense" },
      { property: "og:description", content: "Manage products and stock levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), units_of_measure(name, code)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useStockRows() {
  return useQuery({
    queryKey: ["stock-quants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_quants")
        .select("*, products(name, sku, units_of_measure(code)), locations(name, code, warehouses(name, code))")
        .order("product_id");
      if (error) throw error;
      return data;
    },
  });
}

function ProductsPage() {
  const userId = useSessionUserId();
  const { data: isManager } = useIsManager(userId);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Your catalog and live stock levels.
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New product
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <ProductsTab search={search} isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <StockTab search={search} />
        </TabsContent>
      </Tabs>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function ProductsTab({
  search,
  isManager,
}: {
  search: string;
  isManager: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useProducts();
  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: (e) =>
      toast.error(e.message.includes("IN_USE")
        ? "This product is used by an open operation and can't be removed."
        : e.message),
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Unit cost</TableHead>
            <TableHead className="text-right">Reorder min</TableHead>
            <TableHead>Status</TableHead>
            {isManager && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                No products found.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((p) => (
            <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.sku}</TableCell>
              <TableCell>{p.product_categories?.name}</TableCell>
              <TableCell>{p.units_of_measure?.code}</TableCell>
              <TableCell className="text-right">{Number(p.unit_cost).toFixed(2)}</TableCell>
              <TableCell className="text-right">{Number(p.reorder_min_qty)}</TableCell>
              <TableCell>
                <Badge variant={p.is_active ? "secondary" : "outline"}>
                  {p.is_active ? "Active" : "Archived"}
                </Badge>
              </TableCell>
              {isManager && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggleActive.isPending}
                    onClick={() =>
                      toggleActive.mutate({ id: p.id, is_active: !p.is_active })
                    }
                  >
                    {p.is_active ? "Archive" : "Restore"}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StockTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useStockRows();
  const [edits, setEdits] = useState<Record<number, string>>({});

  const filtered = useMemo(
    () =>
      (data ?? []).filter((r) => {
        const name = r.products?.name?.toLowerCase() ?? "";
        const sku = r.products?.sku?.toLowerCase() ?? "";
        const q = search.toLowerCase();
        return name.includes(q) || sku.includes(q);
      }),
    [data, search],
  );

  const save = useMutation({
    mutationFn: async (row: {
      product_id: number;
      location_id: number;
      counted: number;
    }) => setStock(row.product_id, row.location_id, row.counted),
    onSuccess: () => {
      toast.success("Stock updated — saved as an adjustment");
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ["stock-quants"] });
      queryClient.invalidateQueries({ queryKey: ["stock-totals"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Reserved</TableHead>
            <TableHead className="text-right">Free to use</TableHead>
            <TableHead className="w-40 text-right">Update stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No stock records yet. Validate a receipt to add stock.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((r) => {
            const free = Number(r.quantity) - Number(r.reserved_quantity);
            const editValue = edits[r.id];
            const dirty = editValue !== undefined && editValue !== String(Number(r.quantity));
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">{r.products?.name}</p>
                  <p className="text-xs text-muted-foreground">{r.products?.sku}</p>
                </TableCell>
                <TableCell>
                  {r.locations?.warehouses?.code
                    ? `${r.locations.warehouses.code} / ${r.locations.name}`
                    : r.locations?.name}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {Number(r.quantity)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {Number(r.reserved_quantity)}
                </TableCell>
                <TableCell className="text-right">{free}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 w-24 text-right"
                      value={editValue ?? String(Number(r.quantity))}
                      onChange={(e) =>
                        setEdits((s) => ({ ...s, [r.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!dirty || save.isPending}
                      onClick={() =>
                        save.mutate({
                          product_id: r.product_id,
                          location_id: r.location_id,
                          counted: Number(editValue),
                        })
                      }
                    >
                      Save
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uomId, setUomId] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [reorderMin, setReorderMin] = useState("0");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const { data: uoms } = useQuery({
    queryKey: ["uoms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units_of_measure")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        name: name.trim(),
        sku: sku.trim(),
        category_id: Number(categoryId),
        uom_id: Number(uomId),
        unit_cost: Number(unitCost) || 0,
        reorder_min_qty: Number(reorderMin) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product created");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      setName(""); setSku(""); setCategoryId(""); setUomId("");
      setUnitCost("0"); setReorderMin("0");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Pick..." /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit of measure</Label>
              <Select value={uomId} onValueChange={setUomId}>
                <SelectTrigger><SelectValue placeholder="Pick..." /></SelectTrigger>
                <SelectContent>
                  {uoms?.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit cost</Label>
              <Input type="number" min={0} step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reorder min qty</Label>
              <Input type="number" min={0} step="any" value={reorderMin} onChange={(e) => setReorderMin(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !sku.trim() || !categoryId || !uomId || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
