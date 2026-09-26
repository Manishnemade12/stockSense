import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/apiClient";

export type AppRole = "INVENTORY_MANAGER" | "WAREHOUSE_STAFF";

export interface UserProfile {
  id: number | string;
  login_id: string;
  email: string;
  full_name?: string | null;
  role: AppRole;
  warehouse_id?: number | null;
  phone?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
}

export type Profile = UserProfile;

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("stocksense_token");
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("stocksense_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("stocksense_token", token);
  localStorage.setItem("stocksense_user", JSON.stringify(user));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("stocksense_token");
  localStorage.removeItem("stocksense_user");
}

/** Current auth user id, resolved on mount. `undefined` = loading, `null` = unauthenticated. */
export function useSessionUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      setUserId(String(user.id));
    } else {
      setUserId(null);
    }
  }, []);

  return userId;
}

export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<UserProfile> => {
      const stored = getStoredUser();
      try {
        const res = await api.get<{ user: UserProfile }>("/auth/me");
        if (res?.user) {
          localStorage.setItem("stocksense_user", JSON.stringify(res.user));
          return res.user;
        }
      } catch {
        if (stored) return stored;
      }
      if (stored) return stored;
      throw new Error("Unauthenticated");
    },
    initialData: getStoredUser() || undefined,
    staleTime: 60 * 1000,
  });
}

export function useIsManager(userId?: string | null) {
  const { data: profile } = useProfile(userId);
  return useQuery({
    queryKey: ["is-manager", userId, profile?.role],
    queryFn: async () => {
      const role = profile?.role ?? getStoredUser()?.role;
      return role === "INVENTORY_MANAGER";
    },
    initialData: (profile?.role ?? getStoredUser()?.role) === "INVENTORY_MANAGER",
  });
}

export function useUserRole(userId?: string | null) {
  const { data: profile } = useProfile(userId);
  const role: AppRole = (profile?.role ?? getStoredUser()?.role) || "WAREHOUSE_STAFF";
  const isManager = role === "INVENTORY_MANAGER";

  return useQuery({
    queryKey: ["user-role", userId, role],
    queryFn: async () => ({
      role,
      isManager,
      isStaff: !isManager,
    }),
    initialData: {
      role,
      isManager,
      isStaff: !isManager,
    },
  });
}
