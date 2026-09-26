import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsManager, useSessionUserId } from "@/lib/auth";
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
      { name: "description", content: "Manage warehouses, locations, categories, UoM, partners, users and theme." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const userId = useSessionUserId();
  const { data: isManager } = useIsManager(userId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure warehouses, master data, and app preferences.
        </p>
      </div>

      <Tabs defaultValue="warehouses">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="uom">Units of Measure</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          {isManager && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="theme">Theme</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="mt-4">
          <WarehousesTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="uom" className="mt-4">
          <UomTab isManager={!!isManager} />
        </TabsContent>
        <TabsContent value="partners" className="mt-4">
          <PartnersTab isManager={!!isManager} />
        </TabsContent>
        {isManager && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}
        <TabsContent value="theme" className="mt-4">
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
      <p className="py-10 text-center text-sm text-muted-foreground">
        No records yet. {isManager ? "Create your first one above." : ""}
      </p>
    );
  }
  return (
    <div className="rounded-lg border">
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
                        className="h-7 w-7"
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(row.id)}
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
    setAddress((row.cells[2] as string) ?? "");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("warehouses")
          .update({ name: name.trim(), code: code.trim().toUpperCase(), address: address.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Warehouse updated");
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert({ name: name.trim(), code: code.trim().toUpperCase(), address: address.trim() || null });
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
      const { error } = await supabase
        .from("warehouses")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Warehouse deactivated");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  const tableRows =
    (rows ?? []).map((r) => ({
      id: r.id,
      raw: r,
      cells: [r.name, r.code, r.address ?? "—"] as React.ReactNode[],
    }));

  return (
    <div className="space-y-4">
      {isManager && (
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Warehouse
        </Button>
      )}
      <CrudTable
        columns={["Name", "Code", "Address"]}
        rows={tableRows}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => openEdit({ id: row.id, cells: row.cells })}
        onDelete={(id) => setDeleteId(id)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Warehouse" : "New Warehouse"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Short Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WH1"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
      <DeleteDialog open={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

// ─── Locations ────────────────────────────────────────────────────────────────

function LocationsTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id,name,code").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*, warehouse:warehouses(id,name,code)")
        .eq("is_active", true)
        .in("location_type", ["INTERNAL"])
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setWarehouseId("");
    setParentId("");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim(),
        warehouse_id: warehouseId ? Number(warehouseId) : null,
        parent_location_id: parentId ? Number(parentId) : null,
        location_type: "INTERNAL",
      };
      if (editing) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("locations").insert(payload);
        if (error) throw error;
        toast.success("Location created");
      }
      qc.invalidateQueries({ queryKey: ["locations"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const { error } = await supabase.from("locations").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      toast.success("Location deactivated");
      qc.invalidateQueries({ queryKey: ["locations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {isManager && (
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Location
        </Button>
      )}
      <CrudTable
        columns={["Name", "Code", "Warehouse"]}
        rows={(rows ?? []).map((r) => ({
          id: r.id,
          cells: [r.name, r.code, r.warehouse?.name ?? "—"] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => {
          const raw = rows?.find((r) => r.id === row.id);
          if (raw) {
            setEditing(raw);
            setName(raw.name);
            setCode(raw.code);
            setWarehouseId(raw.warehouse_id ? String(raw.warehouse_id) : "");
            setParentId(raw.parent_location_id ? String(raw.parent_location_id) : "");
            setOpen(true);
          }
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "New Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Short Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent Location (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {(rows ?? []).filter((r) => r.id !== editing?.id).map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
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
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { error } = await supabase.from("product_categories").update({ name: name.trim() }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await supabase.from("product_categories").insert({ name: name.trim() });
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
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {isManager && (
        <Button onClick={() => { setEditing(null); setName(""); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Category
        </Button>
      )}
      <CrudTable
        columns={["Name"]}
        rows={(rows ?? []).map((r) => ({ id: r.id, cells: [r.name] as React.ReactNode[] }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => { setEditing(row); setName(row.cells[0] as string); setOpen(true); }}
        onDelete={(id) => setDeleteId(id)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
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
      const { data, error } = await supabase.from("units_of_measure").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { error } = await supabase.from("units_of_measure").update({ name: name.trim(), code: code.trim() }).eq("id", editing.id);
        if (error) throw error;
        toast.success("UoM updated");
      } else {
        const { error } = await supabase.from("units_of_measure").insert({ name: name.trim(), code: code.trim() });
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
      const { error } = await supabase.from("units_of_measure").delete().eq("id", id);
      if (error) throw error;
      toast.success("UoM deleted");
      qc.invalidateQueries({ queryKey: ["uom"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {isManager && (
        <Button onClick={() => { setEditing(null); setName(""); setCode(""); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Unit
        </Button>
      )}
      <CrudTable
        columns={["Name", "Code"]}
        rows={(rows ?? []).map((r) => ({ id: r.id, cells: [r.name, r.code] as React.ReactNode[] }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => {
          const raw = rows?.find((r) => r.id === row.id);
          if (raw) { setEditing(raw); setName(raw.name); setCode(raw.code); setOpen(true); }
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Unit" : "New Unit of Measure"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="pcs, kg, L" required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
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
      const { data, error } = await supabase.from("partners").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (rows ?? []).filter((r) =>
    typeFilter === "ALL" || r.type === typeFilter,
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = { name: name.trim(), type, email: email.trim() || null, phone: phone.trim() || null, address: address.trim() || null };
      if (editing) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editing.id);
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
      const { error } = await supabase.from("partners").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      toast.success("Partner deactivated");
      qc.invalidateQueries({ queryKey: ["partners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {isManager && (
          <Button onClick={() => { setEditing(null); setName(""); setType("SUPPLIER"); setEmail(""); setPhone(""); setAddress(""); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Partner
          </Button>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="SUPPLIER">Suppliers</SelectItem>
            <SelectItem value="CUSTOMER">Customers</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CrudTable
        columns={["Name", "Type", "Email", "Phone"]}
        rows={filtered.map((r) => ({
          id: r.id,
          cells: [r.name, <Badge key="t" variant="outline">{r.type}</Badge>, r.email ?? "—", r.phone ?? "—"] as React.ReactNode[],
        }))}
        isLoading={isLoading}
        isManager={isManager}
        onEdit={(row) => {
          const raw = rows?.find((r) => r.id === row.id);
          if (raw) { setEditing(raw); setName(raw.name); setType(raw.type); setEmail(raw.email ?? ""); setPhone(raw.phone ?? ""); setAddress(raw.address ?? ""); setOpen(true); }
        }}
        onDelete={(id) => setDeleteId(id)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Partner" : "New Partner"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

// ─── Users Tab (Manager only) ─────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("login_id");
      if (error) throw error;
      return data as any[];
    },
  });

  async function handleRoleChange(id: string, role: string) {
    try {
      const { error } = await supabase.from("profiles").update({ role } as any).eq("id", id);
      if (error) throw error;
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleActiveToggle(id: string, current: boolean) {
    try {
      const { error } = await supabase.from("profiles").update({ is_active: !current } as any).eq("id", id);
      if (error) throw error;
      toast.success(!current ? "User activated" : "User deactivated");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Login Id</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows ?? []).map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono">{u.login_id}</TableCell>
              <TableCell>{u.email ?? "—"}</TableCell>
              <TableCell>{u.full_name ?? "—"}</TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  onValueChange={(v) => handleRoleChange(u.id, v)}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAREHOUSE_STAFF">Warehouse Staff</SelectItem>
                    <SelectItem value="INVENTORY_MANAGER">Inventory Manager</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={u.is_verified ? "default" : "outline"} className="text-[10px]">
                  {u.is_verified ? "Yes" : "Pending"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant={u.is_active ? "outline" : "secondary"}
                  className="h-7 text-xs"
                  onClick={() => handleActiveToggle(u.id, u.is_active)}
                >
                  {u.is_active ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Theme Tab ────────────────────────────────────────────────────────────────

function ThemeTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        One click restyles the entire app. Your choice is saved automatically.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); toast.success(`${t.name} theme applied`); }}
              className={cn(
                "relative rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50",
                active && "ring-2 ring-primary",
              )}
            >
              {active && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <div
                className="mb-3 flex h-16 items-end gap-1.5 rounded-lg p-2"
                style={{ backgroundColor: t.swatches[0] }}
              >
                {t.swatches.slice(1).map((c, i) => (
                  <div
                    key={c}
                    className="flex-1 rounded-md"
                    style={{ backgroundColor: c, height: `${(i + 1) * 20}px` }}
                  />
                ))}
              </div>
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-2 flex gap-1">
                {t.swatches.map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
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
          <AlertDialogTitle>Delete this record?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate the record. It will no longer appear in dropdowns or lists.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
