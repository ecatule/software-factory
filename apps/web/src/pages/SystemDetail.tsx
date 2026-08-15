import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal, Pagination, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
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

  if (isLoading) return <p>Loading…</p>;
  if (!system || !systemId) return <p>System not found.</p>;

  return (
    <div className="system-detail-page">
      <header>
        <h1>
          {system.name} <Badge label={system.stAtivo ? "ACTIVE" : "INACTIVE"} />
        </h1>
        {canWrite && (
          <button type="button" onClick={toggleActive}>
            {system.stAtivo ? "Deactivate system" : "Activate system"}
          </button>
        )}
      </header>

      <section>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField label="Description" type="textarea" registration={register("description")} />
          {canWrite && <button type="submit">Save</button>}
        </form>
        {saveMessage && <p className="form-success">{saveMessage}</p>}
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
      setToggleMessage(`"${artifact.name}" ${artifact.stAtivo ? "deactivated" : "activated"}.`);
    } catch (error) {
      // Previously unhandled — a failed toggle (e.g. an expired session,
      // see AuthContext.tsx) looked exactly like "not allowing" it, with no
      // feedback at all.
      if (error instanceof ApiError) {
        const message = (error.body as { message?: string })?.message;
        setToggleError(message ?? `Request failed (${error.status}). Try reloading the page.`);
      } else {
        setToggleError("Unexpected error updating the artifact.");
      }
    }
  }

  const columns: ColumnDef<SystemArtifact, unknown>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "Type", accessorKey: "type" },
    { header: "Technology", accessorKey: "technology" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.stAtivo ? "ACTIVE" : "INACTIVE"} /> },
    {
      header: "Actions",
      cell: ({ row }) =>
        canWrite && (
          <span className="icon-actions">
            <button
              type="button"
              className="icon-button"
              title="Edit"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              ✎
            </button>
            <button
              type="button"
              className="icon-button"
              title={row.original.stAtivo ? "Deactivate" : "Activate"}
              aria-label={row.original.stAtivo ? "Deactivate" : "Activate"}
              disabled={updateArtifact.isPending}
              onClick={() => toggleActive(row.original)}
            >
              {row.original.stAtivo ? "⏸" : "▶"}
            </button>
          </span>
        ),
    },
  ];

  return (
    <section>
      <h2>Artefatos</h2>
      <div className="systems-artifacts-toolbar">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {canWrite && (
          <button type="button" onClick={openCreate}>
            New artifact
          </button>
        )}
      </div>
      {toggleError && <p className="form-error">{toggleError}</p>}
      {toggleMessage && <p className="form-success">{toggleMessage}</p>}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No artifacts match."
      />
      {data && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      <Modal
        title={editingArtifact ? "Edit artifact" : "New artifact"}
        isOpen={isCreating || editingArtifact !== null}
        onClose={() => {
          setIsCreating(false);
          setEditingArtifact(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" registration={register("name", { required: true })} />
          <div className="form-field">
            <label htmlFor="artifactType">Type</label>
            <select id="artifactType" {...register("type", { required: true })}>
              {ARTIFACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <FormField label="Technology" registration={register("technology")} />
          <FormField label="Description" type="textarea" registration={register("description")} />
          <div className="form-field">
            <label htmlFor="artifactRepositoryIds">Repositórios</label>
            {/* follow-up: links this catalog artifact to real Repository row(s) —
                without this, selecting the artifact in a demand's wizard has
                nothing for the Developer Agent to clone/branch/commit. */}
            <select id="artifactRepositoryIds" multiple {...register("repositoryIds")}>
              {activeRepositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.externalReference}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Save artifact</button>
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
    <section>
      <h3>Upload em lote (CSV)</h3>
      <p>
        Arquivo com cabeçalho <code>name,type,technology,description</code> (ou
        <code>nome,tipo,tecnologia,descricao</code>), separado por vírgula ou ponto-e-vírgula —
        uma linha por Artefato.
      </p>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileSelected} />
      {rows.length > 0 && (
        <>
          <p>{rows.length} linha(s) prontas para envio:</p>
          <ul>
            {rows.slice(0, 10).map((r, i) => (
              <li key={i}>
                {r.name || "(sem nome)"} — {r.type || "(sem tipo)"}
                {r.technology ? `, ${r.technology}` : ""}
              </li>
            ))}
            {rows.length > 10 && <li>… e mais {rows.length - 10}</li>}
          </ul>
          <button type="button" onClick={submit} disabled={bulkCreate.isPending}>
            Enviar {rows.length} artefato(s)
          </button>
        </>
      )}
      {results && (
        <p className={errorRows.length ? "form-error" : "form-success"}>
          {createdCount} criado(s), {errorRows.length} com erro
          {errorRows.length > 0 &&
            `: ${errorRows.map((r) => `linha ${r.row} (${r.name}) — ${r.message}`).join("; ")}`}
        </p>
      )}
    </section>
  );
}
