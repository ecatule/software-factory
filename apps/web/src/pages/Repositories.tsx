import { useState } from "react";
import { DataTable, Modal, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useRepositoriesList, useRepositoryArtifacts, type Repository } from "../services/useRepositories";

/** spec User Story 12: repositories across projects and their linked artifacts. */
export function Repositories() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRepositoriesList(page);
  const [openRepoId, setOpenRepoId] = useState<string | null>(null);
  const { data: artifacts } = useRepositoryArtifacts(openRepoId);

  const columns: ColumnDef<Repository, unknown>[] = [
    { header: "Reference", accessorKey: "externalReference" },
    { header: "Project", accessorKey: "projectId" },
  ];

  return (
    <div className="repositories-page">
      <h1>Repositories</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(repo) => setOpenRepoId(repo.id)}
        emptyMessage="No repositories registered yet."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Linked artifacts" isOpen={openRepoId !== null} onClose={() => setOpenRepoId(null)}>
        <ul>
          {artifacts?.map((a) => (
            <li key={a.id}>
              {a.name} ({a.type})
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
