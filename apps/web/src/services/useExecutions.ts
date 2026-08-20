import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { PaginatedResult } from "./types";

export interface Execution {
  id: string;
  agentId: string;
  /** follow-up: joined server-side (agentId → Agent) so the UI can show a name instead of a raw id. */
  agent: { id: string; name: string; type: string } | null;
  demandId: string;
  /** follow-up: joined server-side (demandId → Demand, no Prisma relation exists) so the UI can show a title instead of a raw id. */
  demandTitle: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "AWAITING_MANUAL_STAGE";
  /** follow-up: live progress marker for the "developer" agent's multi-step pipeline (branches/cloning/safety-check/tasks/analyze/checklist/implement) — null for other agent types until their stage starts. */
  pipelineStage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
}

/** follow-up: human-readable labels for `pipelineStage`, primarily the "developer" agent's pre-implement chain. */
export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  branches: "Preparando branches",
  cloning: "Clonando repositórios",
  "safety-check": "Verificação de segurança",
  tasks: "Gerando tarefas (/speckit-tasks)",
  analyze: "Analisando consistência (/speckit-analyze)",
  checklist: "Gerando checklist (/speckit-checklist)",
  implement: "Implementando (/speckit-implement)",
  "qa-generation": "Gerando casos de teste (QA)",
  commit: "Commitando alterações",
};

export function pipelineStageLabel(stage: string | null): string | null {
  if (!stage) return null;
  return PIPELINE_STAGE_LABELS[stage] ?? stage;
}

/** human-readable labels for `Execution.status` — display only, never touches the underlying value. */
export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Na fila",
  RUNNING: "Em execução",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  AWAITING_MANUAL_STAGE: "Aguardando avanço manual",
};

export function executionStatusLabel(status: string): string {
  return EXECUTION_STATUS_LABELS[status] ?? status;
}

/**
 * follow-up: `Execution.output` stays `unknown` (it's whatever JSON shape
 * the agent type happened to write — see `ExecutionsProcessor`), so this
 * narrows it just enough to read the "developer" agent's post-implement
 * fields, without pretending the whole `output` has a fixed schema.
 */
export interface DeveloperExecutionOutput {
  hasUnassistedNote?: boolean;
  unassistedNoteExcerpt?: string | null;
  specContent?: string;
  tasksContent?: string;
}

export function readDeveloperOutput(output: unknown): DeveloperExecutionOutput {
  return (output && typeof output === "object" ? output : {}) as DeveloperExecutionOutput;
}

/** feature 003 (research.md §10): polls a single execution, same POLL_INTERVAL_MS convention as useDemandPolling. */
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "AWAITING_MANUAL_STAGE"]);

/**
 * follow-up: previously polled automatically while any row was non-terminal
 * — reverted after feedback (same reasoning as `useDemandPolling`: calling
 * the API continuously in the background is unwanted). The Executions page
 * now has its own manual "Atualizar" button instead, calling `refetch()`.
 */
export function useExecutionsList(page: number, status?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: ["executions", { page, status }],
    queryFn: () => apiGet<PaginatedResult<Execution>>(`/executions?${params.toString()}`),
  });
}

/**
 * `poll` defaults to `true` (e.g. ReviewStep watching a just-triggered
 * execution) — pass `poll: false` for screens that already have their own
 * manual refresh action instead (e.g. the Executions list/detail).
 */
export function useExecution(id: string | null, options?: { poll?: boolean }) {
  const poll = options?.poll ?? true;
  return useQuery({
    queryKey: ["execution", id],
    queryFn: () => apiGet<Execution>(`/executions/${id}`),
    enabled: id !== null,
    refetchInterval: (query) => {
      if (!poll) return false;
      return query.state.data && TERMINAL_STATUSES.has(query.state.data.status) ? false : POLL_INTERVAL_MS;
    },
  });
}

/**
 * `POST /executions/:id/retry` — for a "developer" agent execution that
 * already reached `implement`/`commit` with the SPEC/PLAN it used still the
 * current approved ones, `ExecutionsService.retry()` skips straight back to
 * `implement` instead of re-running branches/cloning/safety-check/tasks/
 * analyze/checklist from scratch (see executions.service.ts).
 */
export function useRetryExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => apiPost<Execution>(`/executions/${executionId}/retry`),
    meta: { successMessage: "Execução reiniciada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}

/**
 * feature 006 (pipeline configurável): `POST /executions/:id/advance` — só
 * válido pra uma execução em `AWAITING_MANUAL_STAGE`. Cria uma NOVA
 * execução (mesmo padrão de "Reexecutar") retomando exatamente da etapa
 * pendente — pode parar de novo, na etapa seguinte, se ela também for
 * manual.
 */
export function useAdvanceExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => apiPost<Execution>(`/executions/${executionId}/advance`),
    meta: { successMessage: "Etapa avançada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}

export interface ExecutionStageLog {
  id: string;
  executionId: string;
  stage: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
}

/** feature 006 (pipeline configurável): histórico real de início/fim por etapa — distinto de `pipelineStage` (só a etapa atual). */
export function useExecutionStages(executionId: string | null) {
  return useQuery({
    queryKey: ["execution", executionId, "stages"],
    queryFn: () => apiGet<ExecutionStageLog[]>(`/executions/${executionId}/stages`),
    enabled: executionId !== null,
  });
}

/**
 * `POST /executions/:id/cancel` — flips the row to CANCELLED regardless of
 * whether a live subprocess is still found for it (`ExecutionsService.cancel`
 * best-effort kills the tracked process first, but always marks CANCELLED),
 * so this is also the way to unstick a job whose process already died
 * without the row ever reaching a terminal status.
 */
export function useCancelExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => apiPost<Execution>(`/executions/${executionId}/cancel`),
    meta: { successMessage: "Execução cancelada." },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}
