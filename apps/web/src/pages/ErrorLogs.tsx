import { useState } from "react";
import { Badge, DataTable, Modal, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { useErrorLogList, type ErrorLogEntry } from "../services/useErrorLogs";

/** written by the backend's global ErrorLogFilter — surfaces what used to only exist in the API process's raw console. */
export function ErrorLogs() {
  const [statusCode, setStatusCode] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useErrorLogList({
    statusCode: statusCode ? Number(statusCode) : undefined,
    page,
  });
  const [viewing, setViewing] = useState<ErrorLogEntry | null>(null);

  const columns: ColumnDef<ErrorLogEntry, unknown>[] = [
    { header: "Quando", cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString() },
    { header: "Método", accessorKey: "method" },
    { header: "URL", accessorKey: "url" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge
          label={String(row.original.statusCode)}
          tone={row.original.isHttpException ? "neutral" : "danger"}
        />
      ),
    },
    { header: "Mensagem", cell: ({ row }) => row.original.message },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Logs de Erro</h1>
        <Input
          placeholder="Filtrar por status code (ex: 500)"
          value={statusCode}
          onChange={(e) => setStatusCode(e.target.value)}
          className="max-w-xs"
        />
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(row) => setViewing(row)}
        emptyMessage="Nenhum erro registrado corresponde a estes filtros."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Detalhe do erro" isOpen={viewing !== null} onClose={() => setViewing(null)} className="modal-wide">
        {viewing && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {new Date(viewing.occurredAt).toLocaleString()} — {viewing.method} {viewing.url} —{" "}
              {viewing.exceptionName ?? "Error"}
            </p>
            <p className="text-sm text-muted-foreground">Correlation ID: {viewing.correlationId}</p>
            <h3 className="text-sm font-semibold text-foreground">Mensagem</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-xs text-foreground">
              {viewing.message}
            </pre>
            {viewing.stack && (
              <>
                <h3 className="text-sm font-semibold text-foreground">Stack trace</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-xs text-foreground">
                  {viewing.stack}
                </pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
