import { useState } from "react";
import { DataTable, Modal, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useWorkspaceTree, useWorkspacesList } from "../services/useWorkspaces";
import type { DemandWorkspace } from "../services/types";

/** spec User Story 6: browse demand workspaces across the platform. */
export function Workspaces() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWorkspacesList(page);
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);
  const { data: tree } = useWorkspaceTree(openWorkspaceId);

  const columns: ColumnDef<DemandWorkspace, unknown>[] = [
    { header: "Path", accessorKey: "path" },
    { header: "Status", accessorKey: "status" },
  ];

  return (
    <div className="workspaces-page">
      <h1>Workspaces</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(workspace) => setOpenWorkspaceId(workspace.id)}
        emptyMessage="No workspaces created yet."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal
        title="Workspace tree"
        isOpen={openWorkspaceId !== null}
        onClose={() => setOpenWorkspaceId(null)}
      >
        {tree ? (
          <div>
            <h3>spec/</h3>
            <ul>
              {tree.spec.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <h3>artefatos/</h3>
            <ul>
              {tree.artefatos.map((a) => (
                <li key={a.artifact}>
                  {a.artifact} ({a.files.length} files)
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Loading tree…</p>
        )}
      </Modal>
    </div>
  );
}
