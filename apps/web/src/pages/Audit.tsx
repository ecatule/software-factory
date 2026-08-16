import { useState } from "react";
import { DataTable, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { useAuditList, type AuditLogEntry } from "../services/useAudit";

/** spec User Story 14: search the audit log. */
export function Audit() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditList({ entityType: entityType || undefined, page });

  const columns: ColumnDef<AuditLogEntry, unknown>[] = [
    { header: "Quando", accessorFn: (row) => new Date(row.occurredAt).toLocaleString() },
    { header: "Ator", accessorKey: "actorUserId" },
    { header: "Ação", accessorKey: "action" },
    { header: "Entidade", accessorFn: (row) => `${row.entityType} ${row.entityId ?? ""}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Auditoria</h1>
        <Input
          placeholder="Filtrar por tipo de entidade (ex: demands)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="max-w-xs"
        />
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="Nenhum registro de auditoria corresponde a estes filtros."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}
    </div>
  );
}
