import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const buttonClass =
  "inline-flex h-8 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

/** Renders next to every DataTable driven by the shared `{items,total,page,page_size}` envelope. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(buttonClass)}
      >
        <ChevronLeft className="size-4" /> Previous
      </button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(buttonClass)}
      >
        Next <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
