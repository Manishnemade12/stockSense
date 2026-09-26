import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  FolderTree,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Scale,
  Tag,
  Trash2,
  Users,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsManager, useSessionUserId, type AppRole } from "@/lib/auth";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StockSense" },
      {
        name: "description",
        content:
          "Manage warehouses, locations, categories, UoM, partners, users, and themes.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const userId = useSessionUserId();
  const { data: isManager, isLoading } = useIsManager(userId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isManager === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Warehouse className="h-7 w-7" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-xl font-bold tracking-tight">Manager Access Required</h2>
          <p className="text-sm text-muted-foreground">
            Warehouse settings, master data configuration, and user permissions are restricted to Inventory Managers.
          </p>
        </div>
        <Link to="/dashboard">
          <Button variant="default" className="mt-2">
            Back to Operations Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure warehouses, locations, product master data, user roles, and
          app preferences.
        </p>
      </div>

      <Tabs defaultValue="warehouses" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
          <TabsTrigger value="warehouses" className="gap-1.5">
            <Warehouse className="h-3.5 w-3.5" />
            Warehouses
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="uom" className="gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Units of Measure
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Partners
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Users
            </TabsTrigger>
          )}
          <TabsTrigger value="theme" className="gap-1.5">
            Theme
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="space-y-4">
          <WarehousesTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="locations" className="space-y-4">
          <LocationsTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="categories" className="space-y-4">
          <CategoriesTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="uom" className="space-y-4">
          <UomTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="partners" className="space-y-4">
          <PartnersTab isManager={!!isManager} />
        </TabsContent>
        {isManager && (
          <TabsContent value="users" className="space-y-4">
            <UsersTab currentUserId={userId} />
          </TabsContent>
        )}
        <TabsContent value="theme" className="space-y-4">
          <ThemeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Generic CRUD Table ───────────────────────────────────────────────────────

function CrudTable({
  columns,
  rows,
  isLoading,
  isManager,
  onEdit,
  onDelete,
}: {
  columns: string[];
  rows: { id: number; cells: React.ReactNode[] }[];
  isLoading: boolean;
  isManager: boolean;
  onEdit?: (row: any) => void;
  onDelete?: (id: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No records found. {isManager ? "Create your first one above." : ""}
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
            {isManager && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, i) => (
                <TableCell key={i}>{cell}</TableCell>
              ))}
              {isManager && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(row)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(row.id)}
                        title="Deactivate"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

function WarehousesTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setAddress("");
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setName(row.cells[0] as string);
    setCode(row.cells[1] as string);
    setAddress((row.cells[2] as string) === "—" ? "" : (row.cells[2] as string));
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error("Name and short code are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("warehouses")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Warehouse updated");
      } else {
        const { error } = await supabase.from("warehouses").insert(payload);
        if (error) throw error;
        toast.success("Warehouse created");
      }
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      // Check if warehouse is referenced by non-canceled operations
      const { count, error: countErr } = await supabase
        .from("stock_operations")
        .select("*", { count: "exact", head: true })
        .eq("warehouse_id", id)
        .neq("status", "CANCELED");

      if (countErr) throw countErr;
      if (count && count > 0) {
        toast.error(
          `Cannot deactivate warehouse: referenced by ${count} active operation(s).`,
        );
        return;
      }

      const { error } = await supabase
        .from("warehouses")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Warehouse deactivated");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeleteId(null);
    }
  }

  const tableRows = (rows ?? []).map((r) => ({
    id: r.id,
    cells: [
      <span key="name" className="font-medium text-foreground">{r.name}</span>,
      <Badge key="code" variant="secondary" className="font-mono">{r.code}</Badge>,
      r.address ?? "—",
    ] as React.ReactNode[],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Warehouses define physical buildings and stock-holding facilities.
        </p>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Warehouse
          </Button>
        )}
      </div>

      <CrudTable
        columns={["Name", "Short Code", "Address"]}
        rows={tableRows}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => openEdit(row)}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Warehouse" : "New Warehouse"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main Warehouse"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Short Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WH1"
                className="uppercase"
                required
              />
              <p className="text-xs text-muted-foreground">
                Used as prefix for document reference numbers (e.g. WH1/IN/0001).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Industrial Way, Sector 4"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Locations ────────────────────────────────────────────────────────────────

function LocationsTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("ALL");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
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

  const { data: rows, isLoading } = useQuery({
    queryKey: ["locations", selectedWarehouseFilter],
    queryFn: async () => {
      let q = supabase
        .from("locations")
        .select("*, warehouse:warehouses(id,name,code)")
        .eq("is_active", true)
        .eq("location_type", "INTERNAL")
        .order("name");

      if (selectedWarehouseFilter !== "ALL") {
        q = q.eq("warehouse_id", Number(selectedWarehouseFilter));
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Query all active internal locations for parent lookup
  const { data: allLocations } = useQuery({
    queryKey: ["all-internal-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, warehouse_id")
        .eq("is_active", true)
        .eq("location_type", "INTERNAL")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const parentNameMap = new Map((allLocations ?? []).map((l) => [l.id, l.name]));

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setWarehouseId(
      selectedWarehouseFilter !== "ALL"
        ? selectedWarehouseFilter
        : warehouses?.[0]?.id
        ? String(warehouses[0].id)
        : "",
    );
    setParentId("");
    setOpen(true);
  }

  function openEdit(loc: any) {
    setEditing(loc);
    setName(loc.name);
    setCode(loc.code);
    setWarehouseId(loc.warehouse_id ? String(loc.warehouse_id) : "");
    setParentId(loc.parent_location_id ? String(loc.parent_location_id) : "");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !warehouseId) {
      toast.error("Name, short code, and warehouse are required");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim(),
        warehouse_id: Number(warehouseId),
        parent_location_id: parentId ? Number(parentId) : null,
        location_type: "INTERNAL",
      };
      if (editing) {
        const { error } = await supabase
          .from("locations")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("locations").insert(payload);
        if (error) throw error;
        toast.success("Location created");
      }
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["all-internal-locations"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      // Check if location is referenced by quants with stock
      const { count: quantCount } = await supabase
        .from("stock_quants")
        .select("*", { count: "exact", head: true })
        .eq("location_id", id)
        .gt("quantity_on_hand", 0);

      if (quantCount && quantCount > 0) {
        toast.error("Cannot deactivate location: stock currently exists here");
        return;
      }

      const { error } = await supabase
        .from("locations")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Location deactivated");
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["all-internal-locations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeleteId(null);
    }
  }

  const eligibleParents = (allLocations ?? []).filter((l) => {
    if (editing && l.id === editing.id) return false;
    if (warehouseId && l.warehouse_id !== Number(warehouseId)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Warehouse:</Label>
          <Select
            value={selectedWarehouseFilter}
            onValueChange={setSelectedWarehouseFilter}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Warehouses</SelectItem>
              {(warehouses ?? []).map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name} ({w.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Location
          </Button>
        )}
      </div>

      <CrudTable
        columns={["Name", "Code", "Warehouse", "Parent Location"]}
        rows={(rows ?? []).map((r) => ({
          id: r.id,
          raw: r,
          cells: [
            <span key="name" className="font-medium text-foreground">{r.name}</span>,
            <Badge key="code" variant="outline" className="font-mono">{r.code}</Badge>,
            r.warehouse?.name ?? "—",
            r.parent_location_id
              ? parentNameMap.get(r.parent_location_id) ?? "—"
              : "—",
          ] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => {
          const raw = rows?.find((r) => r.id === row.id);
          if (raw) openEdit(raw);
        }}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Location" : "New Location"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zone A / Rack 1"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Short Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WH1/STOCK"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse *</Label>
              <Select
                value={warehouseId}
                onValueChange={(val) => {
                  setWarehouseId(val);
                  setParentId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent Location (optional hierarchy)</Label>
              <Select value={parentId || "NONE"} onValueChange={(v) => setParentId(v === "NONE" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (top-level)</SelectItem>
                  {eligibleParents.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

function CategoriesTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
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

  const catMap = new Map((rows ?? []).map((c) => [c.id, c.name]));

  function openCreate() {
    setEditing(null);
    setName("");
    setParentId("");
    setOpen(true);
  }

  function openEdit(cat: any) {
    setEditing(cat);
    setName(cat.name);
    setParentId(cat.parent_category_id ? String(cat.parent_category_id) : "");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        parent_category_id: parentId ? Number(parentId) : null,
      };
      if (editing) {
        const { error } = await supabase
          .from("product_categories")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert(payload);
        if (error) throw error;
        toast.success("Category created");
      }
      qc.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const { count: prodCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category_id", id)
        .eq("is_active", true);

      if (prodCount && prodCount > 0) {
        toast.error(`Cannot deactivate: category is used by ${prodCount} product(s)`);
        return;
      }

      const { error } = await supabase
        .from("product_categories")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Category deactivated");
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeleteId(null);
    }
  }

  const eligibleParents = (rows ?? []).filter((c) =>
    editing ? c.id !== editing.id : true,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Categories group products for stock tracking and reporting.
        </p>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Category
          </Button>
        )}
      </div>

      <CrudTable
        columns={["Category Name", "Parent Category"]}
        rows={(rows ?? []).map((r) => ({
          id: r.id,
          raw: r,
          cells: [
            <span key="name" className="font-medium text-foreground">{r.name}</span>,
            r.parent_category_id ? catMap.get(r.parent_category_id) ?? "—" : "—",
          ] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => openEdit(row.raw)}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Electronics"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parent Category (optional)</Label>
              <Select value={parentId || "NONE"} onValueChange={(v) => setParentId(v === "NONE" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (top-level)</SelectItem>
                  {eligibleParents.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Units of Measure ─────────────────────────────────────────────────────────

function UomTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["uom"],
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

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setOpen(true);
  }

  function openEdit(uom: any) {
    setEditing(uom);
    setName(uom.name);
    setCode(uom.code);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setBusy(true);
    try {
      const payload = { name: name.trim(), code: code.trim() };
      if (editing) {
        const { error } = await supabase
          .from("units_of_measure")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("UoM updated");
      } else {
        const { error } = await supabase.from("units_of_measure").insert(payload);
        if (error) throw error;
        toast.success("UoM created");
      }
      qc.invalidateQueries({ queryKey: ["uom"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const { count: prodCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("uom_id", id)
        .eq("is_active", true);

      if (prodCount && prodCount > 0) {
        toast.error(`Cannot deactivate: UoM is used by ${prodCount} product(s)`);
        return;
      }

      const { error } = await supabase
        .from("units_of_measure")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("UoM deactivated");
      qc.invalidateQueries({ queryKey: ["uom"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Units of Measure define the counting or volume standards for products (e.g. pcs, kg, m).
        </p>
        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Unit
          </Button>
        )}
      </div>

      <CrudTable
        columns={["Unit Name", "Short Code"]}
        rows={(rows ?? []).map((r) => ({
          id: r.id,
          raw: r,
          cells: [
            <span key="name" className="font-medium text-foreground">{r.name}</span>,
            <Badge key="code" variant="secondary" className="font-mono">{r.code}</Badge>,
          ] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => openEdit(row.raw)}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Unit of Measure" : "New Unit of Measure"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pieces"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="pcs, kg, L"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Partners ─────────────────────────────────────────────────────────────────

function PartnersTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [name, setName] = useState("");
  const [type, setType] = useState<"SUPPLIER" | "CUSTOMER">("SUPPLIER");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (rows ?? []).filter(
    (r) => typeFilter === "ALL" || r.type === typeFilter,
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setType("SUPPLIER");
    setEmail("");
    setPhone("");
    setAddress("");
    setOpen(true);
  }

  function openEdit(partner: any) {
    setEditing(partner);
    setName(partner.name);
    setType(partner.type);
    setEmail(partner.email ?? "");
    setPhone(partner.phone ?? "");
    setAddress(partner.address ?? "");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Partner name is required");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        type,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("partners")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Partner updated");
      } else {
        const { error } = await supabase.from("partners").insert(payload);
        if (error) throw error;
        toast.success("Partner created");
      }
      qc.invalidateQueries({ queryKey: ["partners"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const { count: opsCount } = await supabase
        .from("stock_operations")
        .select("*", { count: "exact", head: true })
        .eq("partner_id", id)
        .neq("status", "CANCELED");

      if (opsCount && opsCount > 0) {
        toast.error(`Cannot deactivate: partner is referenced by ${opsCount} active operation(s)`);
        return;
      }

      const { error } = await supabase
        .from("partners")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Partner deactivated");
      qc.invalidateQueries({ queryKey: ["partners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Type Filter:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Partners</SelectItem>
              <SelectItem value="SUPPLIER">Suppliers</SelectItem>
              <SelectItem value="CUSTOMER">Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isManager && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Partner
          </Button>
        )}
      </div>

      <CrudTable
        columns={["Name", "Type", "Email", "Phone", "Address"]}
        rows={filtered.map((r) => ({
          id: r.id,
          raw: r,
          cells: [
            <span key="name" className="font-medium text-foreground">{r.name}</span>,
            <Badge
              key="t"
              variant="outline"
              className={
                r.type === "SUPPLIER"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-500"
              }
            >
              {r.type}
            </Badge>,
            r.email ?? "—",
            r.phone ?? "—",
            <span key="addr" className="max-w-[180px] truncate block text-xs text-muted-foreground" title={r.address ?? ""}>
              {r.address ?? "—"}
            </span>,
          ] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => openEdit(row.raw)}
        onDelete={(id) => setDeleteId(id)}
      />

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Partner" : "New Partner"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Supplies Ltd."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Supplier (Receipts)</SelectItem>
                  <SelectItem value="CUSTOMER">Customer (Deliveries)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address (used on delivery slips)</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="456 Commerce Blvd"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Users Tab (Manager only) ─────────────────────────────────────────────────

function UsersTab({ currentUserId }: { currentUserId?: string | undefined }) {
  const qc = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
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

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*, warehouse:warehouses(id,name,code)")
        .order("login_id");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roleMap.get(p.id) ?? "WAREHOUSE_STAFF") as AppRole,
      }));
    },
  });

  async function handleUpdate(
    user: NonNullable<typeof users>[number],
    changes: {
      role?: AppRole;
      warehouse_id?: number | null;
      is_active?: boolean;
    },
  ) {
    setUpdatingId(user.id);
    const newRole = changes.role ?? user.role;
    const newWarehouseId =
      changes.warehouse_id !== undefined ? changes.warehouse_id : user.warehouse_id;
    const newIsActive =
      changes.is_active !== undefined ? changes.is_active : user.is_active;

    if (user.id === currentUserId && newRole !== "INVENTORY_MANAGER") {
      toast.error("You cannot demote your own account.");
      setUpdatingId(null);
      return;
    }

    try {
      const { error } = await supabase.rpc("admin_update_user", {
        _user_id: user.id,
        _role: newRole,
        _warehouse_id: (newWarehouseId ?? null) as unknown as number,
        _is_active: newIsActive,
      });

      if (error) throw error;
      toast.success("User permissions updated");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Assign roles and primary warehouses to staff members. New accounts default to Warehouse Staff.
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Login ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Assigned Warehouse</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => {
              const isSelf = u.id === currentUserId;
              const isBusy = updatingId === u.id;

              return (
                <TableRow key={u.id} className={!u.is_active ? "opacity-60 bg-muted/20" : ""}>
                  <TableCell className="font-mono font-medium">
                    {u.login_id}
                    {isSelf && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell>{u.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      disabled={isBusy}
                      value={u.warehouse_id ? String(u.warehouse_id) : "NONE"}
                      onValueChange={(val) =>
                        handleUpdate(u, {
                          warehouse_id: val === "NONE" ? null : Number(val),
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Unassigned</SelectItem>
                        {(warehouses ?? []).map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name} ({w.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      disabled={isBusy || isSelf}
                      value={u.role}
                      onValueChange={(v) => handleUpdate(u, { role: v as AppRole })}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WAREHOUSE_STAFF">
                          Warehouse Staff
                        </SelectItem>
                        <SelectItem value="INVENTORY_MANAGER">
                          Inventory Manager
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={u.is_active ? "outline" : "secondary"}
                      className={cn(
                        "h-8 text-xs gap-1.5",
                        u.is_active
                          ? "hover:border-destructive hover:text-destructive"
                          : "text-emerald-500",
                      )}
                      disabled={isBusy || isSelf}
                      onClick={() => handleUpdate(u, { is_active: !u.is_active })}
                    >
                      {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Theme Tab ────────────────────────────────────────────────────────────────

function ThemeTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Select a visual palette. Your choice applies instantly and is saved to your browser.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                toast.success(`${t.name} theme applied`);
              }}
              className={cn(
                "relative rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active && "ring-2 ring-primary border-primary",
              )}
            >
              {active && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <div
                className="mb-3 flex h-16 items-end gap-1.5 rounded-lg p-2.5 border"
                style={{ backgroundColor: t.swatches[0] }}
              >
                {t.swatches.slice(1).map((c, i) => (
                  <div
                    key={c}
                    className="flex-1 rounded-sm shadow-sm"
                    style={{ backgroundColor: c, height: `${(i + 1) * 22}px` }}
                  />
                ))}
              </div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {t.description}
              </p>
              <div className="mt-3 flex gap-1.5">
                {t.swatches.map((c) => (
                  <span
                    key={c}
                    className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate this record?</AlertDialogTitle>
          <AlertDialogDescription>
            This record will be safely deactivated (soft-deleted). It will no
            longer appear in selectors or new transactions, but existing historical
            records will be preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
