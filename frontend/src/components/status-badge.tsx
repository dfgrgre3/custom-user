const USER_STATUS_STYLES: Record<string, string> = {
  active: "bg-ok-soft text-ok",
  invited: "bg-warn-soft text-warn",
  suspended: "bg-err-soft text-err",
};

const SYNC_STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-ok-soft text-ok",
  FAILED: "bg-err-soft text-err",
  RUNNING: "bg-run-soft text-run",
};

export function UserStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        USER_STATUS_STYLES[status] ?? "bg-surface text-muted"
      }`}
    >
      {status}
    </span>
  );
}

export function SyncStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        SYNC_STATUS_STYLES[status] ?? "bg-surface text-muted"
      }`}
    >
      {status}
    </span>
  );
}
