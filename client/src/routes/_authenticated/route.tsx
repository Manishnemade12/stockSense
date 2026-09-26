import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ChevronDown,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  PackageOpen,
  Settings,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsManager, useProfile, useSessionUserId } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, managerOnly: false },
  { to: "/products", label: "Products", icon: Package, managerOnly: false },
  { to: "/move-history", label: "Move History", icon: History, managerOnly: false },
  { to: "/settings", label: "Settings", icon: Settings, managerOnly: true },
] as const;

const OP_ITEMS = [
  { type: "RECEIPT" as const, label: "Receipts", icon: PackageOpen },
  { type: "DELIVERY" as const, label: "Deliveries", icon: PackageCheck },
  { type: "INTERNAL_TRANSFER" as const, label: "Internal Transfers", icon: ArrowLeftRight },
  { type: "ADJUSTMENT" as const, label: "Adjustments", icon: SlidersHorizontal },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useSessionUserId();
  const { data: profile } = useProfile(userId);
  const { data: isManager } = useIsManager(userId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const opsActive = pathname.startsWith("/operations");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.full_name || profile?.login_id || "?")
    .slice(0, 2)
    .toUpperCase();

  // Filter navigation items based on role (Settings is strictly manager-only)
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.managerOnly || isManager);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="mr-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
              StockSense
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {visibleNavItems.slice(0, 1).map((item) => (
              <NavLink key={item.to} item={item} pathname={pathname} />
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1",
                    opsActive && "bg-accent text-accent-foreground",
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  Operations
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {OP_ITEMS.map((op) => (
                  <DropdownMenuItem key={op.type} asChild>
                    <Link
                      to="/operations/$type"
                      params={{ type: op.type }}
                      className="flex items-center gap-2"
                    >
                      <op.icon className="h-4 w-4" />
                      {op.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {visibleNavItems.slice(1).map((item) => (
              <NavLink key={item.to} item={item} pathname={pathname} />
            ))}
          </nav>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{profile?.full_name || profile?.login_id}</p>
                  <Badge
                    variant={isManager ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 shrink-0 font-medium",
                      isManager ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isManager ? "Admin" : "Staff"}
                  </Badge>
                </div>
                <p className="text-xs font-normal text-muted-foreground truncate">
                  {profile?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: (typeof NAV_ITEMS)[number];
  pathname: string;
}) {
  const active = pathname.startsWith(item.to);
  return (
    <Link to={item.to}>
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-2", active && "bg-accent text-accent-foreground")}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Button>
    </Link>
  );
}
