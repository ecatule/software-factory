import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useRepositoriesList,
  useRepositoryArtifacts,
  useUpdateRepository,
  type Repository,
} from "../services/useRepositories";

interface RepositoryFormValues {
  productionBranch: string;
  homologationBranch: string;
}

/** spec User Story 12: repositories across projects and their linked artifacts. */
export function Repositories() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRepositoriesList(page);
  const [editing, setEditing] = useState<Repository | null>(null);
  const [showingArtifactsFor, setShowingArtifactsFor] = useState<string | null>(null);
  const { data: artifacts } = useRepositoryArtifacts(showingArtifactsFor);
  const updateRepository = useUpdateRepository();
  const { register, handleSubmit, reset } = useForm<RepositoryFormValues>();

  const columns: ColumnDef<Repository, unknown>[] = [
    { header: "Reference", accessorKey: "externalReference" },
    { header: "Project", accessorKey: "projectId" },
    { header: "Production branch", accessorKey: "productionBranch" },
    { header: "Homologation branch", accessorKey: "homologationBranch" },
  ];

  function openEdit(repo: Repository) {
    reset({
      productionBranch: repo.productionBranch ?? "",
      homologationBranch: repo.homologationBranch ?? "",
    });
    setEditing(repo);
  }

  async function onSubmit(values: RepositoryFormValues) {
    if (!editing) return;
    await updateRepository.mutateAsync({ id: editing.id, ...values });
    setEditing(null);
  }

  return (
    <div className="repositories-page">
      <h1>Repositories</h1>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="No repositories registered yet."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal
        title="Edit repository"
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Production branch" registration={register("productionBranch")} />
          <FormField label="Homologation branch" registration={register("homologationBranch")} />
          <button type="submit">Save</button>
        </form>
        {editing && (
          <button type="button" onClick={() => setShowingArtifactsFor(editing.id)}>
            View linked artifacts
          </button>
        )}
      </Modal>

      <Modal
        title="Linked artifacts"
        isOpen={showingArtifactsFor !== null}
        onClose={() => setShowingArtifactsFor(null)}
      >
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
