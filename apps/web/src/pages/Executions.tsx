import { useState } from "react";
import { DataTable, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import {
  executionStatusLabel,
  pipelineStageLabel,
  useExecution,
  useExecutionsList,
  type Execution,
} from "../services/useExecutions";

const STATUS_TONE: Record<Execution["status"], "neutral" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** spec User Story 10: cross-platform execution monitor. */
export function Executions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading, refetch } = useExecutionsList(page, status || undefined);
  const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);
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
      cell: ({ row }) => <Badge label={executionStatusLabel(row.original.status)} tone={STATUS_TONE[row.original.status]} />,
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
    </div>
  );
}
