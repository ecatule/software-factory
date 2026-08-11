import { useState } from "react";
import { DataTable, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useExecution, useExecutionsList, pipelineStageLabel, type Execution } from "../services/useExecutions";

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
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} tone={STATUS_TONE[row.original.status]} /> },
    {
      header: "Etapa atual",
      cell: ({ row }) =>
        row.original.status === "RUNNING" ? pipelineStageLabel(row.original.pipelineStage) ?? "—" : "—",
    },
    { header: "Início", cell: ({ row }) => formatDateTime(row.original.startedAt) },
    { header: "Fim", cell: ({ row }) => formatDateTime(row.original.finishedAt) },
  ];

  return (
    <div className="executions-page">
      <header>
        <h1>Executions</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="QUEUED">QUEUED</option>
          <option value="RUNNING">RUNNING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        {/* follow-up: replaces the previous auto-polling (2s interval while
            anything was non-terminal) — reverted after feedback, same
            reasoning as useDemandPolling: calling the API continuously in
            the background is unwanted. Refresh is now explicit. */}
        <button type="button" onClick={refresh} disabled={isLoading}>
          Atualizar
        </button>
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(row) => setOpenExecutionId(row.id)}
        emptyMessage="No executions match these filters."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Execution detail" isOpen={openExecutionId !== null} onClose={() => setOpenExecutionId(null)}>
        {openExecution.data && (
          <div>
            <p>
              <Badge label={openExecution.data.status} tone={STATUS_TONE[openExecution.data.status]} />
              {openExecution.data.status === "RUNNING" && pipelineStageLabel(openExecution.data.pipelineStage) && (
                <span> — {pipelineStageLabel(openExecution.data.pipelineStage)}</span>
              )}
            </p>
            <p>
              Início: {formatDateTime(openExecution.data.startedAt)} · Fim:{" "}
              {formatDateTime(openExecution.data.finishedAt)}
            </p>
            {openExecution.data.status === "RUNNING" && (
              <button type="button" onClick={() => void openExecution.refetch()}>
                Atualizar
              </button>
            )}
            {openExecution.data.error && <p className="form-error">{openExecution.data.error}</p>}
            <h3>Input</h3>
            <pre>{JSON.stringify(openExecution.data.input, null, 2)}</pre>
            <h3>Output</h3>
            <pre>{JSON.stringify(openExecution.data.output, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
