import { DataTable } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { TimelineEntry } from "../services/types";

interface Props {
  entries?: TimelineEntry[];
}

const columns: ColumnDef<TimelineEntry, unknown>[] = [
  { header: "Quando", cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString() },
  { header: "Ação", accessorKey: "action" },
  {
    header: "Entidade",
    cell: ({ row }) => `${row.original.entityType}${row.original.entityId ? ` (${row.original.entityId})` : ""}`,
  },
];

/** spec User Story 5, Acceptance Scenario 3: chronological event timeline — no per-row action, pure read-only log. */
export function Timeline({ entries }: Props) {
  return <DataTable columns={columns} data={entries ?? []} emptyMessage="Nenhum evento registrado ainda." />;
}
