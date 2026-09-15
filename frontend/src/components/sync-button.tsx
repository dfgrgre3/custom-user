"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { triggerSync } from "@/lib/api";

interface SyncButtonProps {
  onDone?: () => void;
}

export function SyncButton({ onDone }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleClick() {
    setIsSyncing(true);
    setMessage({ text: "Syncing…", isError: false });
    try {
      const result = await triggerSync();
      if (result.status === "SUCCESS") {
        setMessage({
          text: `Synced: +${result.recordsCreated} new, ${result.recordsUpdated} updated, ${result.recordsDeleted} removed.`,
          isError: false,
        });
      } else {
        setMessage({
          text: `Sync failed: ${result.errorMessage ?? result.errorCode ?? "unknown error"}`,
          isError: true,
        });
      }
      onDone?.();
    } catch (error) {
      const text = error instanceof ApiError ? error.message : "Network error while syncing.";
      setMessage({ text, isError: true });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSyncing}
        className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50"
      >
        {isSyncing ? "Syncing…" : "Sync now"}
      </button>
      {message && (
        <span className={`text-sm ${message.isError ? "text-err" : "text-ok"}`}>{message.text}</span>
      )}
    </div>
  );
}
