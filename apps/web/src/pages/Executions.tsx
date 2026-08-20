import { useState } from "react";
import { DataTable, Modal, Pagination, Badge, MarkdownEditor } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, FileText, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "../context/AuthContext";
import {
  executionStatusLabel,
  pipelineStageLabel,
  readDeveloperOutput,
  useAdvanceExecution,
  useCancelExecution,
  useExecution,
  useExecutionStages,
  useExecutionsList,
  useRetryExecution,
  type Execution,
} from "../services/useExecutions";

const CANCELLABLE_STATUSES = new Set<Execution["status"]>(["QUEUED", "RUNNING", "AWAITING_MANUAL_STAGE"]);

const STATUS_TONE: Record<Execution["status"], "neutral" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  AWAITING_MANUAL_STAGE: "warning",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** spec User Story 10: cross-platform execution monitor. */
export function Executions() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading, refetch } = useExecutionsList(page, status || undefined);
  const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ title: string; content: string } | null>(null);
  const retryExecution = useRetryExecution();
  const advanceExecution = useAdvanceExecution();
  const cancelExecution = useCancelExecution();
  const executionStages = useExecutionStages(openExecutionId);
  // follow-up: `pipelineStage` is updated live server-side as the
  // "developer" agent's multi-step pipeline (branches/cloning/safety-check/
  // tasks/analyze/checklist/implement) progresses — but this screen no
  // longer polls automatically (see `refresh` below), so it's a snapshot
  // refreshed only on demand, same as everything else here.
  const openExecution = useExecution(openExecutionId, { poll: false });

  function refresh() {
    void refetch();
    if (openExecutionId) void openExecution.refetch();
  }

  const columns: ColumnDef<Execution, unknown>[] = [
    { header: "Agente", cell: ({ row }) => row.original.agent?.name ?? row.original.agentId },
    { header: "Demanda", cell: ({ row }) => row.original.demandTitle ?? row.original.demandId },
    {
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge label={executionStatusLabel(row.original.status)} tone={STATUS_TONE[row.original.status]} />
          {readDeveloperOutput(row.original.output).hasUnassistedNote && (
            <Badge label="Decisão não assistida" tone="warning" />
          )}
        </div>
      ),
    },
    {
      header: "Etapa atual",
      cell: ({ row }) =>
        row.original.status === "RUNNING" ? pipelineStageLabel(row.original.pipelineStage) ?? "—" : "—",
    },
    { header: "Início", cell: ({ row }) => formatDateTime(row.original.startedAt) },
    { header: "Fim", cell: ({ row }) => formatDateTime(row.original.finishedAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Execuções</h1>
        <div className="flex items-center gap-2">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">Todos os status</option>
            <option value="QUEUED">{executionStatusLabel("QUEUED")}</option>
            <option value="RUNNING">{executionStatusLabel("RUNNING")}</option>
            <option value="COMPLETED">{executionStatusLabel("COMPLETED")}</option>
            <option value="FAILED">{executionStatusLabel("FAILED")}</option>
            <option value="CANCELLED">{executionStatusLabel("CANCELLED")}</option>
          </NativeSelect>
          {/* follow-up: replaces the previous auto-polling (2s interval while
              anything was non-terminal) — reverted after feedback, same
              reasoning as useDemandPolling: calling the API continuously in
              the background is unwanted. Refresh is now explicit. */}
          <Button type="button" variant="outline" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={isLoading ? "animate-spin" : undefined} /> Atualizar
          </Button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(row) => setOpenExecutionId(row.id)}
        emptyMessage="Nenhuma execução corresponde a estes filtros."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Detalhe da execução" isOpen={openExecutionId !== null} onClose={() => setOpenExecutionId(null)}>
        {openExecution.data && (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2">
              <Badge label={executionStatusLabel(openExecution.data.status)} tone={STATUS_TONE[openExecution.data.status]} />
              {readDeveloperOutput(openExecution.data.output).hasUnassistedNote && (
                <Badge label="Decisão não assistida" tone="warning" />
              )}
              {openExecution.data.status === "RUNNING" && pipelineStageLabel(openExecution.data.pipelineStage) && (
                <span className="text-sm text-muted-foreground">
                  — {pipelineStageLabel(openExecution.data.pipelineStage)}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Início: {formatDateTime(openExecution.data.startedAt)} · Fim:{" "}
              {formatDateTime(openExecution.data.finishedAt)}
            </p>
            {openExecution.data.status === "RUNNING" && (
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void openExecution.refetch()}>
                <RefreshCw /> Atualizar
              </Button>
            )}
            {openExecution.data.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {openExecution.data.error}
              </p>
            )}
            {CANCELLABLE_STATUSES.has(openExecution.data.status) && hasPermission("AGENT_EXECUTE") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={cancelExecution.isPending}
                onClick={() => {
                  if (window.confirm("Cancelar esta execução? Essa ação não pode ser desfeita.")) {
                    cancelExecution.mutate(openExecution.data!.id);
                  }
                }}
              >
                <XCircle /> Cancelar
              </Button>
            )}
            {openExecution.data.status === "AWAITING_MANUAL_STAGE" && hasPermission("AGENT_EXECUTE") && (
              <div className="flex flex-col gap-1 self-start">
                <Button
                  type="button"
                  size="sm"
                  disabled={advanceExecution.isPending}
                  onClick={() => advanceExecution.mutate(openExecution.data!.id)}
                >
                  <ChevronRight /> Avançar etapa
                </Button>
                <span className="text-xs text-muted-foreground">
                  Pausada antes de "{pipelineStageLabel(openExecution.data.pipelineStage)}" — configurada como
                  manual em Configuração do Pipeline.
                </span>
              </div>
            )}
            {(openExecution.data.status === "FAILED" || openExecution.data.status === "COMPLETED") &&
              hasPermission("AGENT_EXECUTE") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={retryExecution.isPending}
                  onClick={() => retryExecution.mutate(openExecution.data!.id)}
                  title={
                    openExecution.data.status === "COMPLETED"
                      ? "Roda o /speckit-implement de novo (ex.: para escrever os casos de teste que ficaram pendentes) sem refazer tasks/analyze/checklist, já que SPEC/PLAN não mudaram"
                      : undefined
                  }
                >
                  <RotateCcw /> Reexecutar
                </Button>
              )}
            {(() => {
              const developerOutput = readDeveloperOutput(openExecution.data.output);
              if (!developerOutput.hasUnassistedNote) return null;
              return (
                <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                  <p className="font-medium">
                    O Developer Agent precisou tomar uma decisão sozinho (sem analista disponível) durante o
                    /speckit-implement. Revise antes de aprovar o PR.
                  </p>
                  {developerOutput.unassistedNoteExcerpt && (
                    <pre className="overflow-x-auto whitespace-pre-wrap font-sans text-xs text-foreground">
                      {developerOutput.unassistedNoteExcerpt}
                    </pre>
                  )}
                </div>
              );
            })()}
            {(() => {
              const developerOutput = readDeveloperOutput(openExecution.data.output);
              if (!developerOutput.specContent && !developerOutput.tasksContent) return null;
              return (
                <div className="flex items-center gap-2">
                  {developerOutput.specContent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setViewingDocument({ title: "spec.md", content: developerOutput.specContent! })
                      }
                    >
                      <FileText /> Ver spec.md
                    </Button>
                  )}
                  {developerOutput.tasksContent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setViewingDocument({ title: "tasks.md", content: developerOutput.tasksContent! })
                      }
                    >
                      <FileText /> Ver tasks.md
                    </Button>
                  )}
                </div>
              );
            })()}
            {!!executionStages.data?.length && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">Linha do tempo das etapas</h3>
                <ul className="flex flex-col gap-1">
                  {executionStages.data.map((log) => {
                    const durationMs = log.finishedAt
                      ? new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()
                      : null;
                    return (
                      <li key={log.id} className="flex items-center gap-2 text-sm">
                        <span>
                          {log.status === "COMPLETED" ? "✓" : log.status === "FAILED" ? "✗" : "⏳"}
                        </span>
                        <span className="text-foreground">{pipelineStageLabel(log.stage)}</span>
                        <span className="text-xs text-muted-foreground">
                          {durationMs !== null ? `(${Math.round(durationMs / 1000)}s)` : "(em andamento)"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <h3 className="text-sm font-semibold text-foreground">Entrada</h3>
            <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-xs text-foreground">
              {JSON.stringify(openExecution.data.input, null, 2)}
            </pre>
            <h3 className="text-sm font-semibold text-foreground">Saída</h3>
            <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-xs text-foreground">
              {JSON.stringify(openExecution.data.output, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      <Modal
        title={viewingDocument?.title ?? ""}
        isOpen={viewingDocument !== null}
        onClose={() => setViewingDocument(null)}
        className="modal-wide"
      >
        {viewingDocument && (
          <MarkdownEditor value={viewingDocument.content} onChange={() => {}} readOnly />
        )}
      </Modal>
    </div>
  );
}
