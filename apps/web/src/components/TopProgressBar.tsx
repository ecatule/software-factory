import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * follow-up: visual redesign — "navegação fluida" (user request,
 * 2026-08-15): a slim indeterminate bar at the top of the content area
 * while any query/mutation is in flight, GitHub/Linear style. Driven by
 * React Query's own in-flight counters — no per-page wiring needed, same
 * "wire once centrally" approach as the global toast system.
 */
export function TopProgressBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const active = isFetching + isMutating > 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-transparent transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={!active}
    >
      {active && (
        <div className="h-full w-1/3 animate-[top-progress_1.1s_ease-in-out_infinite] bg-primary" />
      )}
    </div>
  );
}
