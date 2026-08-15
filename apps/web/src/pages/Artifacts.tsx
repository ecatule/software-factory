import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useAuth } from "../context/AuthContext";
import {
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
    { header: "Name", accessorKey: "name" },
    { header: "Type", accessorKey: "type" },
    { header: "Technology", accessorKey: "technology" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} /> },
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Artifacts</h1>
        {hasPermission("DEMAND_WRITE") && (
          <Button type="button" onClick={openCreate}>
            <Plus /> New artifact
          </Button>
        )}
      </header>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(artifact) => setOpenArtifactId(artifact.id)}
        emptyMessage="No artifacts identified yet."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal title="Artifact files" isOpen={openArtifactId !== null} onClose={() => setOpenArtifactId(null)}>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {files?.map((f) => (
            <li key={f.id}>
              {f.filePath} — {f.changeType}
              {f.changeType === "DISCOVERED" && f.reason ? ` (${f.reason})` : null}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal title="New artifact" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactDemandId" className="text-sm font-medium text-foreground">
              Demand
            </label>
            <NativeSelect id="artifactDemandId" {...register("demandId", { required: true })}>
              <option value="">Select a demand…</option>
              {demands?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.externalId} — {d.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField label="Type" registration={register("type", { required: true })} />
          <FormField label="Description" type="textarea" registration={register("description")} />
          <FormField label="Technology" registration={register("technology")} />
          <FormField label="Path" registration={register("path")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactRepositoryIds" className="text-sm font-medium text-foreground">
              Repositories
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
            Create
          </Button>
        </form>
      </Modal>
    </div>
  );
}
