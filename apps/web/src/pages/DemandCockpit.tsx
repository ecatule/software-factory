import { NavLink, Navigate, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDemandPolling } from "../services/useDemandPolling";
import { SummaryTab } from "../components/cockpit-tabs/SummaryTab";
import { SpecificationTab } from "../components/cockpit-tabs/SpecificationTab";
import { ArtifactsTab } from "../components/cockpit-tabs/ArtifactsTab";
import { TasksTab } from "../components/cockpit-tabs/TasksTab";
import { DevelopmentTab } from "../components/cockpit-tabs/DevelopmentTab";
import { TestsTab } from "../components/cockpit-tabs/TestsTab";
import { GitTab } from "../components/cockpit-tabs/GitTab";
import { TimelineTab } from "../components/cockpit-tabs/TimelineTab";
import { AuditTab } from "../components/cockpit-tabs/AuditTab";
import { demandStatusLabel } from "../services/useDemands";

// `key` is also the URL path segment (`/demands/:demandId/:key`, matched
// against useParams().tab below) — only `label` (the tab's visible text)
// gets translated.
const TABS = [
  { key: "summary", label: "Resumo" },
  { key: "specification", label: "Especificação" },
  { key: "artifacts", label: "Artefatos" },
  { key: "tasks", label: "Tarefas" },
  { key: "development", label: "Desenvolvimento" },
  { key: "tests", label: "Testes" },
  { key: "git", label: "Git" },
  { key: "timeline", label: "Linha do tempo" },
  { key: "audit", label: "Auditoria" },
] as const;

/**
 * feature 004 US5/FR-017-FR-019a: tab shell replacing the flat stacked-sections
 * page. Data is fetched exactly once here via useDemandPolling and handed down
 * as props — tabs never re-fetch the same data on their own (FR-019). The
 * active tab is a URL path segment (Clarifications 2026-08-09), so it survives
 * refresh and is linkable; `/demands/:demandId` redirects to `.../summary`.
 */
export function DemandCockpit() {
  const { demandId, tab } = useParams<{ demandId: string; tab?: string }>();
  const { demand, workflow, workspace, artifacts, specifications, timeline, gitActivity, refetchAll } =
    useDemandPolling(demandId ?? "");

  if (!demandId) return <p className="text-sm text-muted-foreground">Nenhuma demanda selecionada.</p>;
  if (demand.isLoading) return <p className="text-sm text-muted-foreground">Carregando demanda…</p>;
  if (demand.isError) return <p className="text-sm text-destructive">Falha ao carregar a demanda.</p>;

  if (!tab) return <Navigate to={`/demands/${demandId}/summary`} replace />;

  const activeTab = TABS.some((t) => t.key === tab) ? tab : "summary";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          {demand.data?.title}
          <span className="text-base font-normal text-muted-foreground">
            {demand.data && `(${demandStatusLabel(demand.data.status)})`}
          </span>
        </h1>
        <Button type="button" variant="outline" onClick={refetchAll}>
          <RefreshCw /> Atualizar
        </Button>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((t) => (
          <NavLink
            key={t.key}
            to={`/demands/${demandId}/${t.key}`}
            className={({ isActive }) =>
              cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {activeTab === "summary" && (
        <SummaryTab demandId={demandId} demand={demand.data} workflow={workflow.data} />
      )}
      {activeTab === "specification" && (
        <SpecificationTab demandId={demandId} specifications={specifications.data} />
      )}
      {activeTab === "artifacts" && <ArtifactsTab artifacts={artifacts.data} />}
      {activeTab === "tasks" && <TasksTab />}
      {activeTab === "development" && <DevelopmentTab workspace={workspace.data} />}
      {activeTab === "tests" && <TestsTab demandId={demandId} />}
      {activeTab === "git" && (
        <GitTab demandId={demandId} activity={gitActivity.data} artifacts={artifacts.data} />
      )}
      {activeTab === "timeline" && <TimelineTab entries={timeline.data} />}
      {activeTab === "audit" && <AuditTab demandId={demandId} />}
    </div>
  );
}
