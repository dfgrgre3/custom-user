"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import { HealthStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

/**
 * Replaces a previously hardcoded "System / Ready" badge that reflected no
 * real signal — it would say "Ready" even if Supabase or the customer API
 * were down. Polls the backend's GET /health, which actually exercises
 * both dependencies.
 */
export function SystemStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getHealth();
      if (!cancelled) setHealth(result);
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const isOk = health?.status === "ok";
  const isError = health?.status === "error";

  const label = health === null ? "Checking…" : isOk ? "Ready" : "Degraded";
  const dotClass = health === null ? "bg-muted" : isOk ? "bg-ok" : "bg-err";
  const textClass = health === null ? "text-muted" : isOk ? "text-ok" : "text-err";

  const title = isError
    ? [
        health.components.database.status === "error" && "Database unreachable",
        health.components.customerApi.status === "error" && "Customer API unreachable",
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <div
      className="hidden rounded-lg border border-border bg-surface px-3 py-2 text-right sm:block"
      title={title}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">System</p>
      <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-medium ${textClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} /> {label}
      </p>
    </div>
  );
}
