import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsManager, useProfile, useSessionUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
      { name: "description", content: "View and edit your profile." },
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

  // Initialise state from profile when loaded
  const initialized = fullName !== "" || phone !== "";
  if (profile && !initialized) {
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setProfileBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    setPwBusy(true);
    try {
      // Re-authenticate first to verify current password
      const { data: me } = await supabase.auth.getUser();
      if (!me.user?.email) throw new Error("Not logged in");
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
      <div className="space-y-4 max-w-xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal details and password.
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
              <CardTitle>Account Info</CardTitle>
              <CardDescription>
                These fields are set by your administrator.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ReadField label="Login Id" value={profile?.login_id ?? "—"} mono />
          <ReadField label="Email" value={profile?.email ?? "—"} />
          <ReadField label="Role" value={isManager ? "Inventory Manager" : "Warehouse Staff"} />
          <ReadField
            label="Warehouse"
            value={profile?.warehouse_id ? `Warehouse #${profile.warehouse_id}` : "All Warehouses"}
          />
          <ReadField
            label="Account Status"
            value={profile?.is_active ? "Active" : "Inactive"}
          />
        </CardContent>
      </Card>

      {/* Editable profile fields */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            You can update your name and phone number.
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
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 99999 00000"
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
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Confirm your current password before setting a new one.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current Password</Label>
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
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (pwError) setPwError("");
                }}
                required
              />
              {pwError && (
                <p className="text-xs text-destructive">{pwError}</p>
              )}
            </div>
            <Button type="submit" disabled={pwBusy}>
              {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
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
