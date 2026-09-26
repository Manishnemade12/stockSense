import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — StockSense" },
      { name: "description", content: "Set a new StockSense password." },
      { property: "og:title", content: "Reset password — StockSense" },
      { property: "og:description", content: "Set a new StockSense password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully — Welcome to StockSense!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            StockSense
          </span>
          <p className="text-xs text-muted-foreground">
            Core Inventory Management System
          </p>
        </div>

        <Card className="border border-border/80 bg-card/95 shadow-xl backdrop-blur">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-xl font-semibold">Set New Password</CardTitle>
            <CardDescription className="text-xs">
              Enter your new credentials to finish the recovery procedure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-pass" className="text-xs font-medium">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-pass"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-9 pr-9 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-confirm" className="text-xs font-medium">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="pl-9 text-sm"
                    required
                  />
                </div>
                {confirm && password !== confirm && (
                  <p className="text-[11px] text-destructive">
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full font-medium"
                disabled={busy || !password || password !== confirm}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Update Password & Sign In
              </Button>

              <div className="pt-2 text-center text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/auth" })}
                  className="font-medium text-primary hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
