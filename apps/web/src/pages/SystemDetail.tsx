import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Pause, Pencil, Play, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  useBulkCreateSystemArtifacts,
  useCreateSystemArtifact,
  useSystem,
  useSystemArtifacts,
  useUpdateSystem,
  useUpdateSystemArtifact,
  type BulkArtifactResult,
  type SystemArtifact,
  type SystemArtifactInput,
} from "../services/useSystems";
import { useRepositoriesList } from "../services/useRepositories";

interface SystemFormValues {
  name: string;
  description: string;
}

const ARTIFACT_TYPES = [
  "Tela",
  "API",
  "Serviço",
  "Worker",
  "Banco de Dados",
  "Microserviço",
  "Biblioteca",
  "Componente",
  "Outro",
];

/**
 * follow-up: the System edit screen is a full page (not a modal) — a
 * Sistema can carry hundreds of Artefatos (real case: ~300 for "Vexur"),
 * which needs real table/grid space, plus its own edit modal per Artefato.
 */
export function SystemDetail() {
  const { systemId } = useParams<{ systemId: string }>();
  const { hasPermission } = useAuth();
  const { data: system, isLoading } = useSystem(systemId);
  const updateSystem = useUpdateSystem();
  const { register, handleSubmit } = useForm<SystemFormValues>({
    values: system ? { name: system.name, description: system.description ?? "" } : undefined,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const canWrite = hasPermission("SYSTEM_WRITE");

  async function onSubmit(values: SystemFormValues) {
    if (!systemId) return;
    setSaveMessage(null);
    await updateSystem.mutateAsync({ id: systemId, ...values });
    setSaveMessage("Sistema salvo com sucesso.");
  }

  async function toggleActive() {
    if (!systemId || !system) return;
    await updateSystem.mutateAsync({ id: systemId, name: system.name, stAtivo: !system.stAtivo });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!system || !systemId) return <p className="text-sm text-muted-foreground">Sistema não encontrado.</p>;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
          {system.name}
          <Badge label={system.stAtivo ? "ATIVO" : "INATIVO"} tone={system.stAtivo ? "success" : "neutral"} />
        </h1>
        {canWrite && (
          <Button type="button" variant={system.stAtivo ? "destructive" : "outline"} onClick={toggleActive}>
            {system.stAtivo ? "Desativar sistema" : "Ativar sistema"}
          </Button>
        )}
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Nome" registration={register("name", { required: true })} />
          <FormField label="Descrição" type="textarea" registration={register("description")} />
          {canWrite && (
            <Button type="submit" className="self-start">
              Salvar
            </Button>
          )}
        </form>
        {saveMessage && <p className="text-sm font-medium text-success">{saveMessage}</p>}
      </section>

      <SystemArtifacts systemId={systemId} />
    </div>
  );
}

interface ArtifactFormValues {
  name: string;
  type: string;
  technology: string;
  description: string;
  repositoryIds: string[];
}

/**
 * Artefatos of this Sistema, as a real grid (DataTable) with pagination and
 * search — not an unbounded `<ul>` — plus icon actions (Edit/Deactivate)
 * instead of text-labeled buttons.
 */
function SystemArtifacts({ systemId }: { systemId: string }) {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSystemArtifacts(systemId, search, page);
  // follow-up: `useRepositoriesList` returns every Repository regardless of
  // status — Repositories.tsx needs that (it's where you manage/reactivate
  // them), but this dropdown shouldn't ever offer linking an artifact to a
  // deactivated (e.g. wrong/placeholder) repository.
  const { data: repositoriesData } = useRepositoriesList(1);
  const activeRepositories = repositoriesData?.items.filter((r) => r.stAtivo) ?? [];
  const createArtifact = useCreateSystemArtifact(systemId);
  const updateArtifact = useUpdateSystemArtifact(systemId);
  const [editingArtifact, setEditingArtifact] = useState<SystemArtifact | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggleMessage, setToggleMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ArtifactFormValues>();
  const canWrite = hasPermission("SYSTEM_ARTIFACT_WRITE");

  function openCreate() {
    reset({ name: "", type: ARTIFACT_TYPES[0], technology: "", description: "", repositoryIds: [] });
    setEditingArtifact(null);
    setIsCreating(true);
  }

  function openEdit(artifact: SystemArtifact) {
    reset({
      name: artifact.name,
      type: artifact.type,
      technology: artifact.technology ?? "",
      description: artifact.description ?? "",
      repositoryIds: artifact.repositories?.map((r) => r.repositoryId) ?? [],
    });
    setIsCreating(false);
    setEditingArtifact(artifact);
  }

  async function onSubmit(values: ArtifactFormValues) {
    if (editingArtifact) {
      await updateArtifact.mutateAsync({ id: editingArtifact.id, ...values });
      setEditingArtifact(null);
    } else {
      await createArtifact.mutateAsync(values);
      setIsCreating(false);
    }
  }

  async function toggleActive(artifact: SystemArtifact) {
    setToggleError(null);
    setToggleMessage(null);
    try {
      await updateArtifact.mutateAsync({
        id: artifact.id,
        name: artifact.name,
        type: artifact.type,
        stAtivo: !artifact.stAtivo,
      });
      setToggleMessage(`"${artifact.name}" ${artifact.stAtivo ? "desativado" : "ativado"}.`);
    } catch (error) {
      // Previously unhandled — a failed toggle (e.g. an expired session,
      // see AuthContext.tsx) looked exactly like "not allowing" it, with no
      // feedback at all.
      if (error instanceof ApiError) {
        const message = (error.body as { message?: string })?.message;
        setToggleError(message ?? `A requisição falhou (${error.status}). Tente recarregar a página.`);
      } else {
        setToggleError("Erro inesperado ao atualizar o artefato.");
      }
    }
  }

  const columns: ColumnDef<SystemArtifact, unknown>[] = [
    { header: "Nome", accessorKey: "name" },
    { header: "Tipo", accessorKey: "type" },
    { header: "Tecnologia", accessorKey: "technology" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge label={row.original.stAtivo ? "ATIVO" : "INATIVO"} tone={row.original.stAtivo ? "success" : "neutral"} />
      ),
    },
    {
      header: "Ações",
      cell: ({ row }) =>
        canWrite && (
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title="Editar"
              aria-label="Editar"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={row.original.stAtivo ? "Desativar" : "Ativar"}
              aria-label={row.original.stAtivo ? "Desativar" : "Ativar"}
              disabled={updateArtifact.isPending}
              onClick={() => toggleActive(row.original)}
            >
              {row.original.stAtivo ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Artefatos</h2>
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        {canWrite && (
          <Button type="button" onClick={openCreate}>
            <Plus /> Novo artefato
          </Button>
        )}
      </div>
      {toggleError && <p className="text-sm font-medium text-destructive">{toggleError}</p>}
      {toggleMessage && <p className="text-sm font-medium text-success">{toggleMessage}</p>}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="Nenhum artefato encontrado."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal
        title={editingArtifact ? "Editar artefato" : "Novo artefato"}
        isOpen={isCreating || editingArtifact !== null}
        onClose={() => {
          setIsCreating(false);
          setEditingArtifact(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Nome" registration={register("name", { required: true })} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactType" className="text-sm font-medium text-foreground">
              Tipo
            </label>
            <NativeSelect id="artifactType" {...register("type", { required: true })}>
              {ARTIFACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormField label="Tecnologia" registration={register("technology")} />
          <FormField label="Descrição" type="textarea" registration={register("description")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="artifactRepositoryIds" className="text-sm font-medium text-foreground">
              Repositórios
            </label>
            {/* follow-up: links this catalog artifact to real Repository row(s) —
                without this, selecting the artifact in a demand's wizard has
                nothing for the Developer Agent to clone/branch/commit. */}
            <NativeSelect id="artifactRepositoryIds" multiple className="h-auto" {...register("repositoryIds")}>
              {activeRepositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.externalReference}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Salvar artefato
          </Button>
        </form>
      </Modal>

      {canWrite && <BulkArtifactUpload systemId={systemId} />}
    </section>
  );
}

const CSV_COLUMN_ALIASES: Record<keyof SystemArtifactInput, string[]> = {
  name: ["name", "nome"],
  type: ["type", "tipo"],
  technology: ["technology", "tecnologia"],
  description: ["description", "descricao", "descrição"],
  // follow-up: bulk CSV import intentionally doesn't support linking
  // repositories (no column for it — see SystemsService.createArtifactsBulk)
  // — no aliases means the lookup never matches a header, matching that.
  repositoryIds: [],
};

/** Simple, dependency-free CSV parsing (comma or semicolon) — matches the project's "no complex library unless needed" convention. */
function parseArtifactsCsv(text: string): SystemArtifactInput[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  function columnIndex(field: keyof SystemArtifactInput): number {
    return header.findIndex((h) => CSV_COLUMN_ALIASES[field].includes(h));
  }
  const nameIdx = columnIndex("name");
  const typeIdx = columnIndex("type");
  const technologyIdx = columnIndex("technology");
  const descriptionIdx = columnIndex("description");

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    return {
      name: nameIdx >= 0 ? cells[nameIdx] ?? "" : "",
      type: typeIdx >= 0 ? cells[typeIdx] ?? "" : "",
      technology: technologyIdx >= 0 ? cells[technologyIdx] || undefined : undefined,
      description: descriptionIdx >= 0 ? cells[descriptionIdx] || undefined : undefined,
    };
  });
}

/** follow-up: bulk-import Artefatos from a CSV spreadsheet (name,type,technology,description columns, header required). */
function BulkArtifactUpload({ systemId }: { systemId: string }) {
  const bulkCreate = useBulkCreateSystemArtifacts(systemId);
  const [rows, setRows] = useState<SystemArtifactInput[]>([]);
  const [results, setResults] = useState<BulkArtifactResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRows(parseArtifactsCsv(text));
    setResults(null);
  }

  async function submit() {
    const result = await bulkCreate.mutateAsync(rows);
    setResults(result);
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const createdCount = results?.filter((r) => r.status === "created").length ?? 0;
  const errorRows = results?.filter((r) => r.status === "error") ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Upload em lote (CSV)</h3>
      <p className="text-sm text-muted-foreground">
        Arquivo com cabeçalho <code>name,type,technology,description</code> (ou{" "}
        <code>nome,tipo,tecnologia,descricao</code>), separado por vírgula ou ponto-e-vírgula — uma linha por
        Artefato.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFileSelected}
        className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      {rows.length > 0 && (
        <>
          <p className="text-sm text-foreground">{rows.length} linha(s) prontas para envio:</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {rows.slice(0, 10).map((r, i) => (
              <li key={i}>
                {r.name || "(sem nome)"} — {r.type || "(sem tipo)"}
                {r.technology ? `, ${r.technology}` : ""}
              </li>
            ))}
            {rows.length > 10 && <li>… e mais {rows.length - 10}</li>}
          </ul>
          <Button type="button" onClick={submit} disabled={bulkCreate.isPending} className="self-start">
            <Upload /> Enviar {rows.length} artefato(s)
          </Button>
        </>
      )}
      {results && (
        <p className={`text-sm font-medium ${errorRows.length ? "text-destructive" : "text-success"}`}>
          {createdCount} criado(s), {errorRows.length} com erro
          {errorRows.length > 0 &&
            `: ${errorRows.map((r) => `linha ${r.row} (${r.name}) — ${r.message}`).join("; ")}`}
        </p>
      )}
    </section>
  );
}
