"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, listUsers } from "@/lib/api";
import { Pager } from "@/components/pager";
import { SyncButton } from "@/components/sync-button";
import { UserStatusBadge } from "@/components/status-badge";
import { PaginatedUsers, UserStatus } from "@/lib/types";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);

  // Debounce the free-text inputs so we don't fire a request on every
  // keystroke; status/includeDeleted apply immediately since they're
  // discrete choices, not typed text.
  const [debouncedCompany, setDebouncedCompany] = useState(company);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCompany(company);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [company, search]);

  const [result, setResult] = useState<PaginatedUsers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guards against out-of-order responses: if filters change while a
  // request is in flight, a slower earlier response must not overwrite
  // the result of a request issued after it.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listUsers({
        company: debouncedCompany,
        search: debouncedSearch,
        status,
        includeDeleted,
        page,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      setResult(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to load users.");
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [debouncedCompany, debouncedSearch, status, includeDeleted, page]);

  useEffect(() => {
    // Fetches from the backend API on mount and whenever filters/page
    // change; the state updates happen asynchronously after the request
    // resolves, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const users = result?.data ?? [];
  const pagination = result?.pagination;
  const fillerRowCount = isLoading ? 0 : Math.max(0, PAGE_SIZE - Math.max(users.length, 1));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          placeholder="Filter by company…"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        <input
          type="text"
          placeholder="Search name, email, company…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Filter by user status</span>
          <select
            aria-label="Filter by user status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as UserStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">Any status</option>
            <option value="active">active</option>
            <option value="invited">invited</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
            className="rounded border-border text-accent focus:ring-accent-soft"
          />
          include deleted
        </label>
        <div className="flex-1" />
        <SyncButton onDone={load} />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-err bg-err-soft px-3.5 py-2.5 text-sm text-err">
          {error}
        </div>
      )}

      <div
        className={`${isLoading ? "min-h-[850px]" : ""} overflow-x-auto rounded-lg border border-border`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-3.5 py-2.5">Name</th>
              <th className="px-3.5 py-2.5">Email</th>
              <th className="px-3.5 py-2.5">Status</th>
              <th className="px-3.5 py-2.5">Company</th>
              <th className="px-3.5 py-2.5">Role</th>
              <th className="px-3.5 py-2.5">Source updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: PAGE_SIZE }, (_, index) => (
                <tr key={`loading-${index}`} className="h-10 border-b border-border last:border-0">
                  <td colSpan={6} className="px-3.5 py-2.5">
                    {index === 0 && <span className="text-muted">Loading…</span>}
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr className="h-10 border-b border-border">
                <td colSpan={6} className="px-3.5 py-2.5 text-center text-muted">
                  No users found. Try changing the filters or run a sync.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-border last:border-0 ${user.isDeleted ? "opacity-45" : ""}`}
                >
                  <td className="px-3.5 py-2.5">
                    <Link
                      href={`/users/${user.id}`}
                      className="font-medium text-foreground hover:text-accent hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 text-muted">{user.email}</td>
                  <td className="px-3.5 py-2.5">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="px-3.5 py-2.5">{user.company ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-muted">{user.companyRole ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-muted tabular-nums">
                    {new Date(user.sourceUpdatedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
            {Array.from({ length: fillerRowCount }, (_, index) => (
              <tr key={`filler-${index}`} aria-hidden="true" className="h-10 border-b border-border last:border-0">
                <td colSpan={6} className="px-3.5 py-2.5" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="min-h-10">
        {pagination && (
          <Pager
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          />
        )}
      </div>
    </div>
  );
}
