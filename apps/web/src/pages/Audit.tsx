import { useState } from "react";
import { DataTable, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuditList, type AuditLogEntry } from "../services/useAudit";

/** spec User Story 14: search the audit log. */
export function Audit() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditList({ entityType: entityType || undefined, page });

  const columns: ColumnDef<AuditLogEntry, unknown>[] = [
    { header: "When", accessorFn: (row) => new Date(row.occurredAt).toLocaleString() },
    { header: "Actor", accessorKey: "actorUserId" },
    { header: "Action", accessorKey: "action" },
    { header: "Entity", accessorFn: (row) => `${row.entityType} ${row.entityId ?? ""}` },
  ];

  return (
    <div className="audit-page">
      <header>
        <h1>Audit</h1>
        <input
          placeholder="Filter by entity type (e.g. demands)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No audit entries match these filters."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}
    </div>
  );
}
