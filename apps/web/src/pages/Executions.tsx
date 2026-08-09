import { useState } from "react";
import { DataTable, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useExecutionsList, type Execution } from "../services/useExecutions";

const STATUS_TONE: Record<Execution["status"], "neutral" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

/** spec User Story 10: cross-platform execution monitor. */
export function Executions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useExecutionsList(page, status || undefined);
  const [openExecution, setOpenExecution] = useState<Execution | null>(null);

  const columns: ColumnDef<Execution, unknown>[] = [
    { header: "Agent", accessorKey: "agentId" },
    { header: "Demand", accessorKey: "demandId" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} tone={STATUS_TONE[row.original.status]} /> },
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
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={setOpenExecution}
        emptyMessage="No executions match these filters."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Execution detail" isOpen={openExecution !== null} onClose={() => setOpenExecution(null)}>
        {openExecution && (
          <div>
            {openExecution.error && <p className="form-error">{openExecution.error}</p>}
            <h3>Input</h3>
            <pre>{JSON.stringify(openExecution.input, null, 2)}</pre>
            <h3>Output</h3>
            <pre>{JSON.stringify(openExecution.output, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
