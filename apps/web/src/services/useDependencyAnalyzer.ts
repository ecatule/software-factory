import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api";

export interface DependencyAnalysisRun {
  id: string;
  systemArtifactId: string;
  branch: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  stage: string | null;
  summary: {
    filesScanned: number;
    filesParsed: number;
    screensFound: number;
    apiCallsFound: number;
    backendRoutesFound: number;
    methodCallsFound: number;
  } | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** follow-up: same free-text `stage` convention as AgentExecution.pipelineStage — see useExecutions.ts. */
export const DEPENDENCY_STAGE_LABELS: Record<string, string> = {
  cloning: "Clonando repositório",
  analyzing: "Analisando dependências",
  cleanup: "Removendo arquivos locais",
};

export function dependencyStageLabel(stage: string | null): string | null {
  if (!stage) return null;
  return DEPENDENCY_STAGE_LABELS[stage] ?? stage;
}

export const DEPENDENCY_RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Na fila",
  RUNNING: "Em execução",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
};

export function dependencyRunStatusLabel(status: string): string {
  return DEPENDENCY_RUN_STATUS_LABELS[status] ?? status;
}

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);

export function useDependencyAnalyzerSettings() {
  return useQuery({
    queryKey: ["dependency-analyzer-settings"],
    queryFn: () => apiGet<{ defaultBranch: string | null }>("/dependency-analyzer/settings"),
  });
}

export function useUpdateDependencyAnalyzerSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (defaultBranch: string) =>
      apiPatch<{ defaultBranch: string }>("/dependency-analyzer/settings", { defaultBranch }),
    meta: { successMessage: "Branch padrão de mapeamento atualizada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dependency-analyzer-settings"] }),
  });
}

export function useTriggerDependencyAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (systemArtifactId: string) =>
      apiPost<DependencyAnalysisRun>(`/dependency-analyzer/system-artifacts/${systemArtifactId}/analyze`),
    meta: { successMessage: "Mapeamento de dependências iniciado." },
    onSuccess: (_data, systemArtifactId) =>
      queryClient.invalidateQueries({ queryKey: ["dependency-analysis-run", systemArtifactId, "latest"] }),
  });
}

export interface BulkTriggerResult {
  triggered: string[];
  skipped: Array<{ systemArtifactId: string; reason: string }>;
}

/**
 * "Mapear todos os artefatos ativos" — bulk-triggers every active
 * SystemArtifact of one Sistema. The caller shows its own per-artifact
 * triggered/skipped summary, so only the generic success toast is
 * overridden here — errors (e.g. no default branch configured) still go
 * through the global `MutationCache` toast (see query-client.ts), not
 * silenced.
 */
export function useTriggerAllDependencyAnalysis() {
  return useMutation({
    mutationFn: (systemId: string) =>
      apiPost<BulkTriggerResult>(`/dependency-analyzer/systems/${systemId}/analyze-all`),
    meta: { successMessage: "Mapeamento em lote iniciado." },
  });
}

/** polls while the artifact's latest run is non-terminal — used both to disable the trigger button and to drive the progress modal. */
export function useLatestDependencyAnalysisRun(systemArtifactId: string | null) {
  return useQuery({
    queryKey: ["dependency-analysis-run", systemArtifactId, "latest"],
    queryFn: () =>
      apiGet<DependencyAnalysisRun | null>(`/dependency-analyzer/system-artifacts/${systemArtifactId}/runs/latest`),
    enabled: systemArtifactId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !TERMINAL_STATUSES.has(status) ? POLL_INTERVAL_MS : false;
    },
  });
}

export interface ScreenApiCallEvidence {
  screenId: string;
  screenName: string;
  method: string;
  url: string;
  sourceFile: string;
  sourceLine: number;
  sourceSymbol?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface ExposedRouteEvidence {
  method: string;
  url: string;
  controllerName: string | null;
  controllerSourceFile: string | null;
  controllerSourceLine: number | null;
  serviceName: string | null;
  serviceSourceFile: string | null;
  serviceSourceLine: number | null;
}

export interface OutboundApiCallEvidence {
  callerId: string;
  method: string;
  url: string;
  sourceFile: string;
  sourceLine: number;
  sourceSymbol?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface RepositoryMapping {
  screens: ScreenApiCallEvidence[];
  exposedRoutes: ExposedRouteEvidence[];
  outboundCalls: OutboundApiCallEvidence[];
}

/** feeds the "Ver mapeamento" modal — only fetched while that modal is open. */
export function useArtifactDependencyMapping(systemArtifactId: string | null) {
  return useQuery({
    queryKey: ["artifact-dependency-mapping", systemArtifactId],
    queryFn: () =>
      apiGet<RepositoryMapping>(`/dependency-analyzer/system-artifacts/${systemArtifactId}/dependencies`),
    enabled: systemArtifactId !== null,
  });
}

export interface RelatedSystemArtifact {
  method: string;
  url: string;
  repositoryId: string;
  systemArtifactId: string | null;
  systemArtifactName: string | null;
  systemArtifactType: string | null;
  systemId: string | null;
}

/**
 * "Artefatos relacionados" — feeds the specification wizard's dependency
 * preview (`SystemSelection` in SpecificationWorkspace.tsx): which OTHER
 * catalogued artifacts a selected one depends on, resolved via the graph
 * (exact API match, not a name heuristic — see the backend doc-comment on
 * `getRelatedRepositories`). `systemArtifactId` is `null` for a dependency
 * whose target repo hasn't been analyzed/catalogued yet.
 */
export function useRelatedSystemArtifacts(systemArtifactId: string | null) {
  return useQuery({
    queryKey: ["related-system-artifacts", systemArtifactId],
    queryFn: () =>
      apiGet<RelatedSystemArtifact[]>(`/dependency-analyzer/system-artifacts/${systemArtifactId}/related`),
    enabled: systemArtifactId !== null,
  });
}
