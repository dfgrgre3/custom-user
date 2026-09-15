interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pager({ page, totalPages, total, onPrev, onNext }: PagerProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-surface disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Previous
      </button>
      <span className="tabular-nums">
        <span>Page {page} of {totalPages}</span><span className="text-xs">{total} total</span>
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
