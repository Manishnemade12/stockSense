import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/** Current auth user id, resolved once on mount. `undefined` = loading. */
export function useSessionUserId() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null as unknown as string | undefined);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? (null as unknown as string | undefined));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return userId;
}

export function useProfile(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useIsManager(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["is-manager", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: userId!,
          _role: "INVENTORY_MANAGER",
        });
        if (!error && typeof data === "boolean") return data;
      } catch {
        // Fallback to direct query below
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "INVENTORY_MANAGER");
      return !!(data && data.length > 0);
    },
  });
}

export function useUserRole(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["user-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .maybeSingle();
      const role = (data?.role as AppRole) ?? "WAREHOUSE_STAFF";
      return {
        role,
        isManager: role === "INVENTORY_MANAGER",
        isStaff: role === "WAREHOUSE_STAFF",
      };
    },
  });
}
