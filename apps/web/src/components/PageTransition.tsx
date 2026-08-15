import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

/**
 * follow-up: visual redesign — "navegação fluida" (user request,
 * 2026-08-15). React Router v6 has no built-in transition primitive; this
 * re-mounts the page content on every route change (`key={pathname}`) so
 * a plain CSS entrance animation (`tw-animate-css`) replays each time,
 * instead of the previous abrupt/instant swap.
 */
export function PageTransition({ children }: PropsWithChildren) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      {children}
    </div>
  );
}
