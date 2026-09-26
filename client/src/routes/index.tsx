import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredToken } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const token = getStoredToken();
    throw redirect({ to: token ? "/dashboard" : "/auth" });
  },
});
