import {
  HealthStatus,
  PaginatedSyncRuns,
  PaginatedUsers,
  SyncedUser,
  TriggerSyncResult,
  UsersListFilters,
} from "./types";

// The backend (NestJS) runs as its own service; this is the only place in
// the frontend that knows its base URL or route shapes.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Request failed with status ${res.status}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listUsers(filters: UsersListFilters): Promise<PaginatedUsers> {
  const params = new URLSearchParams();
  if (filters.company) params.set("company", filters.company);
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.includeDeleted) params.set("includeDeleted", "true");
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));

  return request<PaginatedUsers>(`/api/v1/users?${params.toString()}`);
}

export function getUser(id: string): Promise<SyncedUser> {
  return request<SyncedUser>(`/api/v1/users/${encodeURIComponent(id)}`);
}

export function listSyncRuns(page: number, limit: number): Promise<PaginatedSyncRuns> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request<PaginatedSyncRuns>(`/api/v1/sync/runs?${params.toString()}`);
}

export function triggerSync(): Promise<TriggerSyncResult> {
  return request<TriggerSyncResult>(`/sync/users`, { method: "POST" });
}

/**
 * Deliberately doesn't use `request()`: `/health` returns a meaningful body
 * on both 200 (all ok) and 503 (a component failed) — `request()` would
 * throw away that body and surface the 503 as a generic ApiError. Any
 * genuine transport failure (backend unreachable) is reported as an
 * "error" status too, rather than propagating an exception the caller has
 * to handle separately from a normal unhealthy response.
 */
export async function getHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return (await res.json()) as HealthStatus;
  } catch {
    return {
      status: "error",
      components: {
        database: { status: "error", error: "Backend unreachable" },
        customerApi: { status: "error", error: "Backend unreachable" },
      },
    };
  }
}
