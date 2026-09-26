import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsManager, useProfile, useSessionUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — StockSense" },
      { name: "description", content: "View and edit your personal details and password." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const userId = useSessionUserId();
  const { data: profile, isLoading } = useProfile(userId);
  const { data: isManager } = useIsManager(userId);

  // Edit fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  // Populate form fields on initial profile load
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  // Query warehouse name
  const { data: warehouse } = useQuery({
    queryKey: ["warehouse", profile?.warehouse_id],
    enabled: !!profile?.warehouse_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("id", profile!.warehouse_id!)
        .single();
      if (error) return null;
      return data;
    },
  });

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setProfileBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Profile updated successfully!");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Profile update failed");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    if (newPassword !== confirmPassword) {
      const err = "New password and confirmation do not match.";
      setPwError(err);
      toast.error(err);
      return;
    }

    if (newPassword.length < 6) {
      const err = "New password must be at least 6 characters long.";
      setPwError(err);
      toast.error(err);
      return;
    }

    setPwBusy(true);
    try {
      // Re-authenticate first to verify current password
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.email) throw new Error("Session expired. Please log in again.");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: me.user.email,
        password: currentPassword,
      });

      if (signInErr) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Password change failed";
      setPwError(msg);
      toast.error(msg);
    } finally {
      setPwBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg border bg-card/60 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          View your assigned account permissions and update your contact information or password.
        </p>
      </div>

      {/* Read-only identity info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>
                System credentials and assigned warehouse permissions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ReadField label="Login ID" value={profile?.login_id ?? "—"} mono />
          <ReadField label="Email" value={profile?.email ?? "—"} />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Role</p>
            <Badge variant="secondary" className="gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {isManager ? "Inventory Manager" : "Warehouse Staff"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Assigned Warehouse</p>
            <p className="text-sm font-medium">
              {warehouse
                ? `${warehouse.name} (${warehouse.code})`
                : profile?.warehouse_id
                ? `Warehouse #${profile.warehouse_id}`
                : "All Warehouses"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Account Status</p>
            <Badge
              variant="outline"
              className={
                profile?.is_active
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {profile?.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Editable profile fields */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Update your full name and phone number for internal communication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <Button type="submit" disabled={profileBusy}>
              {profileBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Security & Password</CardTitle>
              <CardDescription>
                Confirm your current password before setting a new password.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current Password *</Label>
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New Password *</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm New Password *</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (pwError) setPwError("");
                }}
                placeholder="Re-type new password"
                required
              />
              {pwError && (
                <p className="text-xs font-medium text-destructive mt-1">
                  {pwError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={pwBusy} className="gap-2">
              {pwBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`font-medium text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
