"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, listSyncRuns } from "@/lib/api";
import { Pager } from "@/components/pager";
import { SyncButton } from "@/components/sync-button";
import { SyncStatusBadge } from "@/components/status-badge";
import { PaginatedSyncRuns } from "@/lib/types";

const PAGE_SIZE = 20;

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function SyncHistoryPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedSyncRuns | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listSyncRuns(page, PAGE_SIZE);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load sync history.");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // Fetches from the backend API on mount and whenever the page changes;
    // the state updates happen asynchronously after the request resolves,
    // not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const runs = result?.data ?? [];
  const pagination = result?.pagination;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <SyncButton onDone={load} />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-err bg-err-soft px-3.5 py-2.5 text-sm text-err">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-3.5 py-2.5">Started</th>
              <th className="px-3.5 py-2.5">Status</th>
              <th className="px-3.5 py-2.5">Duration</th>
              <th className="px-3.5 py-2.5 text-right">Fetched</th>
              <th className="px-3.5 py-2.5 text-right">Created</th>
              <th className="px-3.5 py-2.5 text-right">Updated</th>
              <th className="px-3.5 py-2.5 text-right">Deleted</th>
              <th className="px-3.5 py-2.5">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-8 text-center text-muted">
                  No synchronization runs yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="border-b border-border last:border-0">
                  <td className="px-3.5 py-2.5 tabular-nums">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-3.5 py-2.5">
                    <SyncStatusBadge status={run.status} />
                  </td>
                  <td className="px-3.5 py-2.5 tabular-nums text-muted">{formatDuration(run.durationMs)}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{run.recordsFetched ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{run.recordsCreated ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{run.recordsUpdated ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{run.recordsDeleted ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-err">
                    {run.errorCode ? (
                      <span title={run.errorMessage ?? ""}>{run.errorCode}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
  );
}
