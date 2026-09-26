import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Check,
  Database,
  Layers,
  Lock,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getStoredToken, getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

export function LandingPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      setIsAuthenticated(true);
      setCurrentUser(user);
    }
  }, []);

  const copyCredential = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied: "${text}"`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/80 shadow-md shadow-primary/20 text-primary-foreground font-bold">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight">StockSense</span>
              <span className="ml-2 hidden rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary sm:inline-block">
                Enterprise Core
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button
                onClick={() => navigate({ to: "/dashboard" })}
                className="gap-2 shadow-sm font-medium"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate({ to: "/auth" })}
                  className="text-xs sm:text-sm font-medium"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate({ to: "/auth" })}
                  className="gap-1.5 text-xs sm:text-sm font-medium shadow-sm"
                >
                  Launch App
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3.5 py-1 text-xs font-medium text-foreground backdrop-blur-xs mb-6 shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Full-Stack PostgreSQL + Express + React System</span>
            </div>

            {/* Main Headline */}
            <h1 className="max-w-4xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground">
              Intelligent Inventory Operations,{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Real-Time Precision.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A comprehensive stock control and warehouse routing platform with double-entry ledger integrity, state-machine operation lifecycles, and role-based access for managers and warehouse staff.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate({ to: isAuthenticated ? "/dashboard" : "/auth" })}
                className="gap-2 text-sm sm:text-base font-semibold px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30"
              >
                {isAuthenticated ? "Open Dashboard" : "Launch StockSense Platform"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <a
                href="#demo-credentials"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm sm:text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                View Demo Accounts
              </a>
            </div>

            {/* Status preview tags */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Zero Phantom Discrepancies</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Audited Stock Ledger</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Multi-Warehouse Routing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo Credentials Section ─────────────────────────────────────── */}
      <section id="demo-credentials" className="py-12 bg-muted/30 border-b">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-8">
            <Badge variant="outline" className="mb-2">1-Click Quick Access</Badge>
            <h2 className="text-2xl font-bold tracking-tight">Pre-Configured Demo Accounts</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Test role-based access immediately using these seeded database credentials.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Admin Card */}
            <Card className="border-primary/20 hover:border-primary/40 transition-all bg-card/80 backdrop-blur-xs shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-primary text-primary-foreground font-mono">INVENTORY_MANAGER</Badge>
                  <span className="text-xs text-muted-foreground">Full Admin Access</span>
                </div>
                <CardTitle className="text-lg flex items-center gap-2 mt-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Admin / Operations Manager
                </CardTitle>
                <CardDescription className="text-xs">
                  Full control over warehouses, locations, categories, validation, users, and adjustments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Login ID</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold">admin</span>
                      <button
                        onClick={() => copyCredential("admin", "admin-id")}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy Login ID"
                      >
                        {copiedKey === "admin-id" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Password</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold">Admin@1234</span>
                      <button
                        onClick={() => copyCredential("Admin@1234", "admin-pass")}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy Password"
                      >
                        {copiedKey === "admin-pass" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full text-xs font-semibold"
                  variant="outline"
                  onClick={() => navigate({ to: "/auth" })}
                >
                  Log In as Admin ➔
                </Button>
              </CardContent>
            </Card>

            {/* Staff Card */}
            <Card className="border-border hover:border-border/80 transition-all bg-card/80 backdrop-blur-xs shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-mono">WAREHOUSE_STAFF</Badge>
                  <span className="text-xs text-muted-foreground">Operational Role</span>
                </div>
                <CardTitle className="text-lg flex items-center gap-2 mt-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  Warehouse Staff / Operator
                </CardTitle>
                <CardDescription className="text-xs">
                  Assigned to Central Warehouse (WH1) for receipts, deliveries, and internal transfers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Login ID</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold">staff</span>
                      <button
                        onClick={() => copyCredential("staff", "staff-id")}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy Login ID"
                      >
                        {copiedKey === "staff-id" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/50 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Password</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold">User@1234</span>
                      <button
                        onClick={() => copyCredential("User@1234", "staff-pass")}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy Password"
                      >
                        {copiedKey === "staff-pass" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full text-xs font-semibold"
                  variant="outline"
                  onClick={() => navigate({ to: "/auth" })}
                >
                  Log In as Staff ➔
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Key Capabilities ─────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-b">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-2">Architecture Highlights</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Enterprise Grade Architecture</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Designed from first principles to provide guaranteed consistency and real-time operational feedback.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Database className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Double-Entry Stock Ledger</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stock never vanishes or appears without a source. Every inbound, outbound, and internal move creates paired ledger entries for full auditable traceability.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">State Machine Workflows</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Operations follow strict lifecycle guarantees: Draft ➔ Waiting (Availability Check) ➔ Ready ➔ Done. Cancellations cleanly release reserved inventory.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Role-Based Access Control</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inventory Managers maintain warehouse configurations and validation rights, while Warehouse Staff execute receipts, transfers, and deliveries safely.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Kanban & List Visualizations</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Switch seamlessly between an interactive status Kanban board and a tabular data grid with filtering, pagination, and multi-criteria searches.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Live KPIs & Stock Intelligence</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instant calculations for on-hand, reserved, and free-to-use quantities, coupled with automatic low-stock and delayed operation flags.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Multi-Warehouse & Locations</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hierarchical location management supporting physical aisles, racks, and bins alongside system virtual locations (Vendors, Customers, Scrap).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t bg-card/50 py-8">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              SS
            </div>
            <span className="font-bold text-sm">StockSense</span>
            <span className="text-xs text-muted-foreground">— Core Inventory Operations System</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              API Gateway: Connected (Port 5000)
            </span>
            <span>•</span>
            <Link to="/auth" className="hover:text-foreground underline">
              Account Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
