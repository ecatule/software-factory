import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    return message ?? `A requisição falhou (${error.status}). Tente recarregar a página.`;
  }
  return fallback;
}

const selectClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      header: "Projeto",
      cell: ({ row }) => projectNameById.get(row.original.projectId) ?? row.original.projectId,
    },
    { header: "Branch de produção", accessorKey: "productionBranch" },
    { header: "Branch de homologação", accessorKey: "homologationBranch" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge label={row.original.stAtivo ? "ATIVO" : "INATIVO"} tone={row.original.stAtivo ? "success" : "neutral"} />
      ),
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
      setCreateError(extractErrorMessage(error, "Falha ao criar o repositório."));
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
      setEditError(extractErrorMessage(error, "Falha ao salvar o repositório."));
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
      setEditError(extractErrorMessage(error, "Falha ao atualizar o status do repositório."));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Repositórios</h1>
        <Button type="button" onClick={openCreate}>
          <Plus /> Novo repositório
        </Button>
      </header>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="Nenhum repositório cadastrado ainda."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Novo repositório" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col gap-4">
          {createError && <p className="text-sm font-medium text-destructive">{createError}</p>}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repo-projectId" className="text-sm font-medium text-foreground">
              Projeto
            </label>
            <select
              id="repo-projectId"
              className={selectClass}
              {...createForm.register("projectId", { required: true })}
            >
              <option value="">Selecione um projeto…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Base (ex: https://github.com/owner)"
            registration={createForm.register("externalReference", { required: true })}
          />
          <FormField label="Branch de produção" registration={createForm.register("productionBranch")} />
          <FormField label="Branch de homologação" registration={createForm.register("homologationBranch")} />
          <Button type="submit" disabled={createRepository.isPending} className="self-start">
            Criar
          </Button>
        </form>
      </Modal>

      <Modal
        title={editing ? `Editar repositório — ${editing.stAtivo ? "ATIVO" : "INATIVO"}` : "Editar repositório"}
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {editError && <p className="text-sm font-medium text-destructive">{editError}</p>}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-repo-projectId" className="text-sm font-medium text-foreground">
              Projeto
            </label>
            <select id="edit-repo-projectId" className={selectClass} {...register("projectId", { required: true })}>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Base (ex: https://github.com/owner)"
            registration={register("externalReference", { required: true })}
          />
          <FormField label="Branch de produção" registration={register("productionBranch")} />
          <FormField label="Branch de homologação" registration={register("homologationBranch")} />
          <Button type="submit" className="self-start">
            Salvar
          </Button>
        </form>
        {editing && (
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowingArtifactsFor(editing.id)}>
              Ver artefatos vinculados
            </Button>
            <Button
              type="button"
              variant={editing.stAtivo ? "destructive" : "outline"}
              size="sm"
              onClick={() => toggleActive(editing)}
              disabled={updateRepository.isPending}
            >
              {editing.stAtivo ? "Desativar" : "Ativar"}
            </Button>
          </div>
        )}
      </Modal>

      <Modal title="Artefatos vinculados" isOpen={showingArtifactsFor !== null} onClose={() => setShowingArtifactsFor(null)}>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
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
