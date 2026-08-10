import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  to: string;
  /** Roles allowed to see this item; omit for "any signed-in user" (spec FR-003). */
  roles?: string[];
  /** feature 004 FR-007a: permission required to see this item, alongside/instead of roles. */
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/" },
  { label: "Clients", to: "/clients" },
  { label: "Projects", to: "/projects" },
  { label: "Sistemas", to: "/systems", permission: "SYSTEM_READ" },
  { label: "Technologies", to: "/technologies" },
  { label: "Demands", to: "/demands" },
  { label: "Workspaces", to: "/workspaces" },
  { label: "Artifacts", to: "/artifacts" },
  { label: "Agents", to: "/agents" },
  { label: "Executions", to: "/executions" },
  { label: "Tests", to: "/tests" },
  { label: "Repositories", to: "/repositories" },
  { label: "Git Activity", to: "/git" },
  { label: "Audit", to: "/audit", permission: "AUDIT_READ" },
  { label: "Settings", to: "/settings", roles: ["admin"] },
];

/**
 * spec FR-002/FR-003: persistent navigation shell, hiding (not just
 * disabling) entries the signed-in user's role doesn't permit.
 */
export function NavShell({ children }: PropsWithChildren) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.roles || item.roles.some((role) => user?.roles.includes(role))) &&
      (!item.permission || hasPermission(item.permission)),
  );

  return (
    <div className="nav-shell">
      <header className="nav-shell-header">
        <span className="nav-shell-brand">AI Software Factory</span>
        <nav>
          {visibleItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? "nav-link-active" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="nav-shell-user">
          <span>{user?.email}</span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="nav-shell-content">{children}</main>
    </div>
  );
}
