const BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) || "/api/v1";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: BodyInit | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers = {}, body, ...rest } = options;
  const token = typeof window !== "undefined" ? localStorage.getItem("stocksense_token") : null;

  let url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        searchParams.append(k, String(v));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    headers: { ...defaultHeaders, ...(headers as Record<string, string>) },
    ...rest,
  };
  if (body !== undefined && body !== null) {
    init.body = body;
  }

  const response = await fetch(url, init);

  const json: ApiResponse<T> | null = await response.json().catch(() => null);

  if (!response.ok) {
    const errMsg = json?.error?.message || response.statusText || "Request failed";

    // Auto-redirect on session expiration
    if (response.status === 401 && !endpoint.includes("/auth/login")) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("stocksense_token");
        localStorage.removeItem("stocksense_user");
        window.location.href = "/auth";
      }
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(errMsg);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  get: <T = any>(endpoint: string, params?: RequestOptions["params"]) =>
    apiRequest<T>(endpoint, params !== undefined ? { method: "GET", params } : { method: "GET" }),

  post: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(
      endpoint,
      body !== undefined
        ? { method: "POST", body: JSON.stringify(body) }
        : { method: "POST" }
    ),

  put: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(
      endpoint,
      body !== undefined
        ? { method: "PUT", body: JSON.stringify(body) }
        : { method: "PUT" }
    ),

  delete: <T = any>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};

export default api;
