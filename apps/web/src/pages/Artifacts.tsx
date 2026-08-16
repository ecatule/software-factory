import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "../context/AuthContext";
import {
  artifactStatusLabel,
  changeTypeLabel,
  useArtifactFiles,
  useArtifactsList,
  useCreateArtifact,
  type CreateArtifactInput,
} from "../services/useArtifacts";
import { useDemandsList } from "../services/useDemands";
import { useRepositoriesList } from "../services/useRepositories";
import type { Artifact } from "../services/types";

/**
 * spec User Story 7: browse artifacts across demands.
 * feature 004 US6: also lets an analyst register a known artifact manually,
 * ahead of the Developer Agent's own discovery — the `POST` endpoint has
 * existed since 001 but no form ever called it.
 */
export function Artifacts() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useArtifactsList(page);
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const { data: files } = useArtifactFiles(openArtifactId);
  const { data: demands } = useDemandsList({ pageSize: 100 });
  const { data: repositories } = useRepositoriesList(1);
  const createArtifact = useCreateArtifact();
  const [isCreating, setIsCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<CreateArtifactInput>();

  const columns: ColumnDef<Artifact, unknown>[] = [
    { header: "Nome", accessorKey: "name" },
    { header: "Tipo", accessorKey: "type" },
    { header: "Tecnologia", accessorKey: "technology" },
    { header: "Status", cell: ({ row }) => <Badge label={artifactStatusLabel(row.original.status)} /> },
  ];

  function openCreate() {
    reset({ demandId: "", name: "", type: "", description: "", technology: "", path: "", repositoryIds: [] });
    setIsCreating(true);
  }

  async function onSubmit(values: CreateArtifactInput) {
    await createArtifact.mutateAsync(values);
    setIsCreating(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Artefatos</h1>
        {hasPermission("DEMAND_WRITE") && (
          <Button type="button" onClick={openCreate}>
            <Plus /> Novo artefato
          </Button>
        )}
      </header>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(artifact) => setOpenArtifactId(artifact.id)}
        emptyMessage="Nenhum artefato identificado ainda."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Arquivos do artefato" isOpen={openArtifactId !== null} onClose={() => setOpenArtifactId(null)}>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {files?.map((f) => (
            <li key={f.id}>
              {f.filePath} — {changeTypeLabel(f.changeType)}
              {f.changeType === "DISCOVERED" && f.reason ? ` (${f.reason})` : null}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal title="Novo artefato" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactDemandId" className="text-sm font-medium text-foreground">
              Demanda
            </label>
            <NativeSelect id="artifactDemandId" {...register("demandId", { required: true })}>
              <option value="">Selecione uma demanda…</option>
              {demands?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.externalId} — {d.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormField label="Nome" registration={register("name", { required: true })} />
          <FormField label="Tipo" registration={register("type", { required: true })} />
          <FormField label="Descrição" type="textarea" registration={register("description")} />
          <FormField label="Tecnologia" registration={register("technology")} />
          <FormField label="Caminho" registration={register("path")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactRepositoryIds" className="text-sm font-medium text-foreground">
              Repositórios
            </label>
            <NativeSelect id="artifactRepositoryIds" multiple className="h-auto" {...register("repositoryIds")}>
              {repositories?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.externalReference}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Criar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
