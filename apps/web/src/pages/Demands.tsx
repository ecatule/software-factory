import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useClientsList } from "../services/useClients";
import { useProjectsList } from "../services/useProjects";
import { useAgentsList } from "../services/useAgents";
import {
  DEMAND_PRIORITIES,
  demandStatusLabel,
  demandTypeLabel,
  useCreateDemand,
  useDemandsList,
  useImportDemand,
  type CreateDemandInput,
  type EnrichedDemand,
} from "../services/useDemands";
import { prStatusLabel } from "../services/useGitActivity";

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
    { header: "ID externo", accessorKey: "externalId" },
    { header: "Título", accessorKey: "title" },
    { header: "Cliente", accessorKey: "clientName" },
    { header: "Projeto", accessorKey: "projectName" },
    { header: "Tipo", cell: ({ row }) => demandTypeLabel(row.original.type) },
    { header: "Prioridade", accessorKey: "priority" },
    { header: "Status", cell: ({ row }) => <Badge label={demandStatusLabel(row.original.status)} /> },
    {
      header: "Incremento",
      cell: ({ row }) => row.original.currentIncrement?.number ?? "—",
    },
    {
      header: "Agente",
      cell: ({ row }) => row.original.currentAgent?.name ?? "—",
    },
    {
      header: "PR",
      cell: ({ row }) =>
        row.original.latestPullRequest
          ? `${row.original.latestPullRequest.externalReference} (${prStatusLabel(row.original.latestPullRequest.status)})`
          : "—",
    },
    {
      header: "Atualizado em",
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
      priority: "Média",
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
        setCreateError("Erro inesperado ao criar a demanda.");
      }
    }
  }

  async function onImport(values: ImportFormValues) {
    await importDemand.mutateAsync(values);
    setIsImporting(false);
    importForm.reset();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Demandas</h1>
        {hasPermission("DEMAND_WRITE") && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setIsImporting(true)}>
              <Download /> Importar do Monday
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus /> Nova demanda
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="NEW">{demandStatusLabel("NEW")}</option>
          <option value="SPECIFICATION">{demandStatusLabel("SPECIFICATION")}</option>
          <option value="DEVELOPMENT">{demandStatusLabel("DEVELOPMENT")}</option>
          <option value="PULL_REQUEST">{demandStatusLabel("PULL_REQUEST")}</option>
          <option value="FAILED">{demandStatusLabel("FAILED")}</option>
        </NativeSelect>
        <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todos os projetos</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Todos os agentes</option>
          {agents?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={prStatus} onChange={(e) => setPrStatus(e.target.value)}>
          <option value="">Qualquer status de PR</option>
          <option value="OPEN">{prStatusLabel("OPEN")}</option>
          <option value="MERGED">{prStatusLabel("MERGED")}</option>
          <option value="CLOSED">{prStatusLabel("CLOSED")}</option>
        </NativeSelect>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={createdAfter}
            onChange={(e) => setCreatedAfter(e.target.value)}
            title="Criada após"
          />
          <Input
            type="date"
            value={createdBefore}
            onChange={(e) => setCreatedBefore(e.target.value)}
            title="Criada antes de"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(demand) => navigate(`/demands/${demand.id}`)}
        emptyMessage="Nenhuma demanda corresponde a estes filtros."
      />
      {data && (
        <Pagination
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      <Modal title="Nova demanda" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {createError && <p className="text-sm font-medium text-destructive">{createError}</p>}
          <FormField label="ID externo" registration={register("externalId", { required: true })} />
          <FormField label="Origem" registration={register("origin", { required: true })} />
          <FormField label="Título" registration={register("title", { required: true })} />
          <FormField
            label="Descrição"
            type="textarea"
            registration={register("description", { required: true })}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="type" className="text-sm font-medium text-foreground">
              Tipo
            </label>
            <NativeSelect id="type" {...register("type", { required: true })}>
              {DEMAND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {demandTypeLabel(t)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="priority" className="text-sm font-medium text-foreground">
              Prioridade
            </label>
            <NativeSelect id="priority" {...register("priority", { required: true })}>
              {DEMAND_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clientId" className="text-sm font-medium text-foreground">
              Cliente
            </label>
            <NativeSelect id="clientId" {...register("clientId", { required: true })}>
              <option value="">Selecione um cliente…</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="projectId" className="text-sm font-medium text-foreground">
              Projeto
            </label>
            <NativeSelect id="projectId" {...register("projectId", { required: true })}>
              <option value="">Selecione um projeto…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Criar
          </Button>
        </form>
      </Modal>

      <Modal title="Importar demanda do Monday" isOpen={isImporting} onClose={() => setIsImporting(false)}>
        <form onSubmit={importForm.handleSubmit(onImport)} className="flex flex-col gap-4">
          <FormField
            label="ID do ticket no Monday"
            registration={importForm.register("externalId", { required: true })}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="importClientId" className="text-sm font-medium text-foreground">
              Cliente
            </label>
            <NativeSelect id="importClientId" {...importForm.register("clientId", { required: true })}>
              <option value="">Selecione um cliente…</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="importProjectId" className="text-sm font-medium text-foreground">
              Projeto
            </label>
            <NativeSelect id="importProjectId" {...importForm.register("projectId", { required: true })}>
              <option value="">Selecione um projeto…</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Importar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
