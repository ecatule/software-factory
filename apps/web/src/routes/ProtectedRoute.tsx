import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps extends PropsWithChildren {
  /** Roles allowed; omit to require only "signed in" (spec FR-001). */
  roles?: string[];
}

/**
 * spec FR-001/FR-003/FR-005: gates every screen on an active session, and
 * optionally a role — redirecting to sign-in (preserving the intended
 * destination) rather than rendering, so restricted data is never fetched.
 */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <p>Loading session…</p>;
  }

  if (status === "signed-out" || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (roles && !roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
