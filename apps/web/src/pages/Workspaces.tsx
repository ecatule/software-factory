import { useState } from "react";
import { DataTable, Modal, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useWorkspaceTree, useWorkspacesList, workspaceStatusLabel } from "../services/useWorkspaces";
import type { DemandWorkspace } from "../services/types";

/** spec User Story 6: browse demand workspaces across the platform. */
export function Workspaces() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWorkspacesList(page);
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);
  const { data: tree } = useWorkspaceTree(openWorkspaceId);

  const columns: ColumnDef<DemandWorkspace, unknown>[] = [
    { header: "Caminho", accessorKey: "path" },
    { header: "Status", cell: ({ row }) => workspaceStatusLabel(row.original.status) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspaces</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(workspace) => setOpenWorkspaceId(workspace.id)}
        emptyMessage="Nenhum workspace criado ainda."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Árvore do workspace" isOpen={openWorkspaceId !== null} onClose={() => setOpenWorkspaceId(null)}>
        {tree ? (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">spec/</h3>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {tree.spec.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">artefatos/</h3>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {tree.artefatos.map((a) => (
                  <li key={a.artifact}>
                    {a.artifact} ({a.files.length} arquivo(s))
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando árvore…</p>
        )}
      </Modal>
    </div>
  );
}
