interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pager({ page, totalPages, total, onPrev, onNext }: PagerProps) {
  return (
    <div className="mt-4 flex items-center gap-3 text-sm text-muted">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Prev
      </button>
      <span className="tabular-nums">
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Next
      </button>
    </div>
  );
}
