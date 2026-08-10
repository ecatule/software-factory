import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useClientsList } from "../services/useClients";
import { useProjectsList } from "../services/useProjects";
import { useAgentsList } from "../services/useAgents";
import {
  useCreateDemand,
  useDemandsList,
  useImportDemand,
  type CreateDemandInput,
  type EnrichedDemand,
} from "../services/useDemands";

const DEMAND_TYPES = ["BUG", "FEATURE", "IMPROVEMENT", "TASK", "TECHNICAL_DEBT"];

interface ImportFormValues {
  externalId: string;
  clientId: string;
  projectId: string;
}

/** spec User Story 5 / feature 004 US4: browse demands with richer filters/columns, create or import one. */
export function Demands() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  // feature 004 FR-012: Dashboard KPI cards deep-link here via query params.
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [statusIn] = useState(searchParams.get("status_in") ?? "");
  const [clientId, setClientId] = useState(searchParams.get("client_id") ?? "");
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [prStatus, setPrStatus] = useState(searchParams.get("pr_status") ?? "");
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [page, setPage] = useState(1);
  const { data: clients } = useClientsList();
  const { data: projects } = useProjectsList();
  const { data: agents } = useAgentsList();
  const { data, isLoading } = useDemandsList({
    status: status || undefined,
    statusIn: statusIn || undefined,
    clientId: clientId || undefined,
    projectId: projectId || undefined,
    agentId: agentId || undefined,
    agentStatus: searchParams.get("agent_status") ?? undefined,
    prStatus: prStatus || undefined,
    hasFailingTests: searchParams.get("has_failing_tests") === "true",
    createdAfter: createdAfter || undefined,
    createdBefore: createdBefore || undefined,
    page,
  });
  const createDemand = useCreateDemand();
  const importDemand = useImportDemand();
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<CreateDemandInput>();
  const importForm = useForm<ImportFormValues>();

  const columns: ColumnDef<EnrichedDemand, unknown>[] = [
    { header: "External ID", accessorKey: "externalId" },
    { header: "Title", accessorKey: "title" },
    { header: "Client", accessorKey: "clientName" },
    { header: "Project", accessorKey: "projectName" },
    { header: "Type", accessorKey: "type" },
    { header: "Priority", accessorKey: "priority" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.status} /> },
    {
      header: "Increment",
      cell: ({ row }) => row.original.currentIncrement?.number ?? "—",
    },
    {
      header: "Agent",
      cell: ({ row }) => row.original.currentAgent?.name ?? "—",
    },
    {
      header: "PR",
      cell: ({ row }) =>
        row.original.latestPullRequest
          ? `${row.original.latestPullRequest.externalReference} (${row.original.latestPullRequest.status})`
          : "—",
    },
    {
      header: "Updated",
      cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
    },
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

  async function onImport(values: ImportFormValues) {
    await importDemand.mutateAsync(values);
    setIsImporting(false);
    importForm.reset();
  }

  return (
    <div className="demands-page">
      <header>
        <h1>Demands</h1>
        {hasPermission("DEMAND_WRITE") && (
          <>
            <button type="button" onClick={openCreate}>
              New demand
            </button>
            <button type="button" onClick={() => setIsImporting(true)}>
              Importar do Monday
            </button>
          </>
        )}
      </header>

      <div className="demands-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="SPECIFICATION">SPECIFICATION</option>
          <option value="DEVELOPMENT">DEVELOPMENT</option>
          <option value="PULL_REQUEST">PULL_REQUEST</option>
          <option value="FAILED">FAILED</option>
        </select>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">All clients</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">All agents</option>
          {agents?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={prStatus} onChange={(e) => setPrStatus(e.target.value)}>
          <option value="">Any PR status</option>
          <option value="OPEN">OPEN</option>
          <option value="MERGED">MERGED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <input
          type="date"
          value={createdAfter}
          onChange={(e) => setCreatedAfter(e.target.value)}
          title="Created after"
        />
        <input
          type="date"
          value={createdBefore}
          onChange={(e) => setCreatedBefore(e.target.value)}
          title="Created before"
        />
      </div>

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

      <Modal
        title="Importar demanda do Monday"
        isOpen={isImporting}
        onClose={() => setIsImporting(false)}
      >
        <form onSubmit={importForm.handleSubmit(onImport)}>
          <FormField
            label="Monday ticket ID"
            registration={importForm.register("externalId", { required: true })}
          />
          <div className="form-field">
            <label htmlFor="importClientId">Client</label>
            <select id="importClientId" {...importForm.register("clientId", { required: true })}>
              <option value="">Select a client…</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="importProjectId">Project</label>
            <select id="importProjectId" {...importForm.register("projectId", { required: true })}>
              <option value="">Select a project…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Importar</button>
        </form>
      </Modal>
    </div>
  );
}
