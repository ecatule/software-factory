import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ApiError } from "../services/api";
import {
  useCreateRepository,
  useRepositoriesList,
  useRepositoryArtifacts,
  useUpdateRepository,
  type Repository,
} from "../services/useRepositories";
import { useProjectsList } from "../services/useProjects";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = (error.body as { message?: string })?.message;
    return message ?? `Request failed (${error.status}). Try reloading the page.`;
  }
  return fallback;
}

interface RepositoryFormValues {
  projectId: string;
  externalReference: string;
  productionBranch: string;
  homologationBranch: string;
}

interface CreateRepositoryFormValues {
  projectId: string;
  externalReference: string;
  productionBranch: string;
  homologationBranch: string;
}

/** spec User Story 12: repositories across projects and their linked artifacts. */
export function Repositories() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useRepositoriesList(page);
  const { data: projects } = useProjectsList();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Repository | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [showingArtifactsFor, setShowingArtifactsFor] = useState<string | null>(null);
  const { data: artifacts } = useRepositoryArtifacts(showingArtifactsFor);
  const createRepository = useCreateRepository();
  const updateRepository = useUpdateRepository();
  const { register, handleSubmit, reset } = useForm<RepositoryFormValues>();
  const createForm = useForm<CreateRepositoryFormValues>();

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const columns: ColumnDef<Repository, unknown>[] = [
    { header: "Base (org/host)", accessorKey: "externalReference" },
    {
      header: "Project",
      cell: ({ row }) => projectNameById.get(row.original.projectId) ?? row.original.projectId,
    },
    { header: "Production branch", accessorKey: "productionBranch" },
    { header: "Homologation branch", accessorKey: "homologationBranch" },
    {
      header: "Status",
      cell: ({ row }) => <Badge label={row.original.stAtivo ? "ACTIVE" : "INACTIVE"} />,
    },
  ];

  function openCreate() {
    setCreateError(null);
    createForm.reset({ projectId: "", externalReference: "", productionBranch: "", homologationBranch: "" });
    setIsCreating(true);
  }

  async function onCreateSubmit(values: CreateRepositoryFormValues) {
    setCreateError(null);
    try {
      await createRepository.mutateAsync({
        projectId: values.projectId,
        externalReference: values.externalReference,
        productionBranch: values.productionBranch || undefined,
        homologationBranch: values.homologationBranch || undefined,
      });
      setIsCreating(false);
    } catch (error) {
      setCreateError(extractErrorMessage(error, "Failed to create repository."));
    }
  }

  function openEdit(repo: Repository) {
    reset({
      projectId: repo.projectId,
      externalReference: repo.externalReference,
      productionBranch: repo.productionBranch ?? "",
      homologationBranch: repo.homologationBranch ?? "",
    });
    setEditError(null);
    setEditing(repo);
  }

  async function onSubmit(values: RepositoryFormValues) {
    if (!editing) return;
    setEditError(null);
    try {
      await updateRepository.mutateAsync({ id: editing.id, ...values });
      setEditing(null);
    } catch (error) {
      setEditError(extractErrorMessage(error, "Failed to save repository."));
    }
  }

  // follow-up: physical delete is forbidden by the project constitution —
  // this was the only catalog screen missing an activate/deactivate toggle
  // (Systems/SystemArtifact already had one), so a wrong/obsolete entry
  // (e.g. a placeholder repo used by mistake) had no way to be gotten rid of.
  async function toggleActive(repo: Repository) {
    setEditError(null);
    try {
      await updateRepository.mutateAsync({ id: repo.id, stAtivo: !repo.stAtivo });
      setEditing(null);
    } catch (error) {
      setEditError(extractErrorMessage(error, "Failed to update repository status."));
    }
  }

  return (
    <div className="repositories-page">
      <header>
        <h1>Repositories</h1>
        <button type="button" onClick={openCreate}>
          New repository
        </button>
      </header>
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

      <Modal title="New repository" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
          {createError && <p className="form-error">{createError}</p>}
          <div className="form-field">
            <label htmlFor="repo-projectId">Project</label>
            <select id="repo-projectId" {...createForm.register("projectId", { required: true })}>
              <option value="">Select a project…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Base (e.g. https://github.com/owner)"
            registration={createForm.register("externalReference", { required: true })}
          />
          <FormField
            label="Production branch"
            registration={createForm.register("productionBranch")}
          />
          <FormField
            label="Homologation branch"
            registration={createForm.register("homologationBranch")}
          />
          <button type="submit" disabled={createRepository.isPending}>
            Create
          </button>
        </form>
      </Modal>

      <Modal
        title={editing ? `Edit repository — ${editing.stAtivo ? "ACTIVE" : "INACTIVE"}` : "Edit repository"}
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {editError && <p className="form-error">{editError}</p>}
          <div className="form-field">
            <label htmlFor="edit-repo-projectId">Project</label>
            <select id="edit-repo-projectId" {...register("projectId", { required: true })}>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Base (e.g. https://github.com/owner)"
            registration={register("externalReference", { required: true })}
          />
          <FormField label="Production branch" registration={register("productionBranch")} />
          <FormField label="Homologation branch" registration={register("homologationBranch")} />
          <button type="submit">Save</button>
        </form>
        {editing && (
          <>
            <button type="button" onClick={() => setShowingArtifactsFor(editing.id)}>
              View linked artifacts
            </button>
            <button type="button" onClick={() => toggleActive(editing)} disabled={updateRepository.isPending}>
              {editing.stAtivo ? "Deactivate" : "Activate"}
            </button>
          </>
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
