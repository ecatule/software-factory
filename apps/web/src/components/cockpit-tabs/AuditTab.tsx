import { useState } from "react";
import { DataTable, DiffView, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { useAuditList, type AuditLogEntry } from "../../services/useAudit";

interface Props {
  demandId: string;
}

function toDiffLines(value: unknown): string[] {
  if (value === null || value === undefined) return ["(nenhum)"];
  return JSON.stringify(value, null, 2).split("\n");
}

function columns(onView: (entry: AuditLogEntry) => void): ColumnDef<AuditLogEntry, unknown>[] {
  return [
    { header: "Quando", cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString() },
    { header: "Ator", accessorKey: "actorUserId" },
    { header: "Ação", accessorKey: "action" },
    {
      header: "Ações",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Ver detalhes"
          aria-label="Ver detalhes"
          onClick={() => onView(row.original)}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];
}

/** feature 004 US5/FR-006: only visible/loaded for users holding AUDIT_READ (defense-in-depth, mirrors the /audit page gate). */
export function AuditTab({ demandId }: Props) {
  const { hasPermission } = useAuth();
  const canRead = hasPermission("AUDIT_READ");
  const { data } = useAuditList({ entityType: "demands", enabled: canRead });
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null);

  if (!canRead) return <p className="text-sm text-muted-foreground">Você não tem permissão para ver a trilha de auditoria.</p>;

  const entries = data?.items.filter((entry) => entry.entityId === demandId) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Auditoria</h2>
      <DataTable
        columns={columns(setViewing)}
        data={entries}
        emptyMessage="Nenhum registro de auditoria para esta demanda ainda."
      />

      <Modal title="Detalhes do registro" isOpen={viewing !== null} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {new Date(viewing.occurredAt).toLocaleString()} — {viewing.action}
            </p>
            <DiffView deletions={toDiffLines(viewing.before)} additions={toDiffLines(viewing.after)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
