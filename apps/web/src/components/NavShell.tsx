import { useEffect, useState, type PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Bot,
  Boxes,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Cpu,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PlayCircle,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { TopProgressBar } from "./TopProgressBar";
import { PageTransition } from "./PageTransition";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Roles allowed to see this item; omit for "any signed-in user" (spec FR-003). */
  roles?: string[];
  /** feature 004 FR-007a: permission required to see this item, alongside/instead of roles. */
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: "Visão geral", items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }] },
  {
    label: "Cadastros",
    items: [
      { label: "Clients", to: "/clients", icon: Building2 },
      { label: "Projects", to: "/projects", icon: FolderKanban },
      { label: "Sistemas", to: "/systems", icon: Boxes, permission: "SYSTEM_READ" },
      { label: "Technologies", to: "/technologies", icon: Cpu },
      { label: "Repositories", to: "/repositories", icon: GitBranch },
    ],
  },
  {
    label: "Trabalho",
    items: [
      { label: "Demands", to: "/demands", icon: ClipboardList },
      { label: "Workspaces", to: "/workspaces", icon: FolderOpen },
      { label: "Artifacts", to: "/artifacts", icon: Package },
      { label: "Agents", to: "/agents", icon: Bot },
      { label: "Executions", to: "/executions", icon: PlayCircle },
      { label: "Tests", to: "/tests", icon: FlaskConical },
    ],
  },
  {
    label: "Governança",
    items: [
      { label: "Git Activity", to: "/git", icon: Activity },
      { label: "Audit", to: "/audit", icon: ShieldCheck, permission: "AUDIT_READ" },
      { label: "Settings", to: "/settings", icon: SettingsIcon, roles: ["admin"] },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = "sf.nav.collapsed";

/**
 * spec FR-002/FR-003: persistent navigation shell, hiding (not just
 * disabling) entries the signed-in user's role doesn't permit.
 * follow-up: visual redesign — top horizontal nav replaced with a
 * collapsible left sidebar (icon + truncated label when collapsed,
 * grouped with separators — matches the reference the user shared),
 * state persisted in localStorage.
 */
export function NavShell({ children }: PropsWithChildren) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.roles || item.roles.some((role) => user?.roles.includes(role))) &&
        (!item.permission || hasPermission(item.permission)),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full">
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out",
            collapsed ? "w-[76px]" : "w-[240px]",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center justify-between gap-2 border-b border-border px-3",
              collapsed && "flex-col justify-center gap-1.5 px-0 py-2",
            )}
          >
            <Logo variant={collapsed ? "icon" : "full"} height={28} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed((c) => !c)}
                  className="size-6 shrink-0 text-muted-foreground"
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? "Expandir" : "Recolher"}</TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {visibleGroups.map((group, index) => (
              <div key={group.label} className={cn("px-2 py-2", index > 0 && "mt-1 border-t border-border")}>
                {!collapsed && (
                  <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = location.pathname === item.to;
                    const Icon = item.icon;
                    const link = (
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-center rounded-md text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground",
                          active && "bg-accent text-accent-foreground",
                          collapsed
                            ? "flex-col gap-1 px-1 py-2 text-center"
                            : "gap-2.5 px-2.5 py-2",
                        )}
                      >
                        <Icon className={cn("shrink-0", collapsed ? "size-5" : "size-4")} />
                        <span className={cn("truncate", collapsed && "w-full text-[10px] leading-tight")}>
                          {item.label}
                        </span>
                      </Link>
                    );
                    return (
                      <li key={item.to}>
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        ) : (
                          link
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-6">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          </header>
          <main className="relative flex-1 overflow-y-auto bg-background p-6">
            <TopProgressBar />
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
