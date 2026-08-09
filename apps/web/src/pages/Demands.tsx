import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ApiError } from "../services/api";
import { useClientsList } from "../services/useClients";
import { useProjectsList } from "../services/useProjects";
import { useCreateDemand, useDemandsList, type CreateDemandInput } from "../services/useDemands";
import type { Demand } from "../services/types";

const DEMAND_TYPES = ["BUG", "FEATURE", "IMPROVEMENT", "TASK", "TECHNICAL_DEBT"];

/** spec User Story 5: browse demands with filters, create one by hand. */
export function Demands() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data: clients } = useClientsList();
  const { data: projects } = useProjectsList();
  const { data, isLoading } = useDemandsList({ status: status || undefined, page });
  const createDemand = useCreateDemand();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<CreateDemandInput>();

  const columns: ColumnDef<Demand, unknown>[] = [
    { header: "External ID", accessorKey: "externalId" },
    { header: "Title", accessorKey: "title" },
    { header: "Type", accessorKey: "type" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} /> },
  ];

  function openCreate() {
    reset({
      externalId: "",
      origin: "manual",
      title: "",
      description: "",
      type: "TASK",
      priority: "medium",
      clientId: "",
      projectId: "",
    });
    setCreateError(null);
    setIsCreating(true);
  }

  async function onSubmit(values: CreateDemandInput) {
    try {
      await createDemand.mutateAsync(values);
      setIsCreating(false);
    } catch (error) {
      // spec FR-011/FR-028: surface the platform's rejection reason clearly,
      // not a raw HTTP error.
      if (error instanceof ApiError) {
        const message = (error.body as { message?: string })?.message;
        setCreateError(message ?? `Request failed (${error.status})`);
      } else {
        setCreateError("Unexpected error creating the demand.");
      }
    }
  }

  return (
    <div className="demands-page">
      <header>
        <h1>Demands</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="SPECIFICATION">SPECIFICATION</option>
          <option value="DEVELOPMENT">DEVELOPMENT</option>
          <option value="PULL_REQUEST">PULL_REQUEST</option>
          <option value="FAILED">FAILED</option>
        </select>
        <button type="button" onClick={openCreate}>
          New demand
        </button>
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(demand) => navigate(`/demands/${demand.id}`)}
        emptyMessage="No demands match these filters."
      />
      {data && (
        <Pagination
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      <Modal title="New demand" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {createError && <p className="form-error">{createError}</p>}
          <FormField label="External ID" registration={register("externalId", { required: true })} />
          <FormField label="Origin" registration={register("origin", { required: true })} />
          <FormField label="Title" registration={register("title", { required: true })} />
          <FormField
            label="Description"
            type="textarea"
            registration={register("description", { required: true })}
          />
          <div className="form-field">
            <label htmlFor="type">Type</label>
            <select id="type" {...register("type", { required: true })}>
              {DEMAND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Priority" registration={register("priority", { required: true })} />
          <div className="form-field">
            <label htmlFor="clientId">Client</label>
            <select id="clientId" {...register("clientId", { required: true })}>
              <option value="">Select a client…</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="projectId">Project</label>
            <select id="projectId" {...register("projectId", { required: true })}>
              <option value="">Select a project…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Create</button>
        </form>
      </Modal>
    </div>
  );
}

