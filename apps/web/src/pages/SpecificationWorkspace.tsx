import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MarkdownEditor, DiffView, Badge, DataTable, Modal } from "@software-factory/ui";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiGet, apiPost, ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSpecification } from "../services/useSpecificationVersions";
import {
  useApproveSpecificationVersion,
  useDeactivateSpecificationVersion,
  useRestoreSpecificationVersion,
  useSpecificationDiff,
  useSpecificationVersionsList,
  useUploadSpecificationVersion,
  type SpecificationVersion,
} from "../services/useSpecificationVersions";
import { useDemand } from "../services/useDemands";
import { useProjectTechnologies } from "../services/useTechnologies";
import {
  useDemandSystemArtifacts,
  useDemandSystems,
  useSetDemandSystemArtifacts,
  useSetDemandSystems,
  type SystemArtifact,
} from "../services/useSystems";
import { useGeneratePromptSpec } from "../services/usePromptSpec";
import { useAgentsList, useTriggerExecution } from "../services/useAgents";
import { executionStatusLabel, useExecution, pipelineStageLabel } from "../services/useExecutions";
import { useIncrementsList } from "../services/useIncrements";
import type { Specification } from "../services/types";

interface OriginBranch {
  productionBranch: string | null;
  homologationBranch: string | null;
  source: "repository" | null;
}

/**
 * spec FR-002 (technical inputs) + spec 004 FR-003: a starting scaffold so
 * the analyst edits/completes sections instead of writing from a blank
 * page. "Branch de Origem" is now resolved automatically from the
 * repository backing the demand's known artifacts (feature 004) —
 * previously a manual-only placeholder. follow-up: production/homologation
 * branch now lives only on Repository (no more Project-level fallback).
 * follow-up (feature 005): "# Telas"/"# APIs" were removed from here — that
 * information now comes from the "Sistemas e Artefatos Envolvidos"
 * selection below, not from free text.
 */
function buildTechnicalTemplate(technologies: string, originBranch: OriginBranch | undefined): string {
  const branchLines =
    originBranch?.productionBranch || originBranch?.homologationBranch
      ? [
          originBranch.productionBranch ? `- Produção: ${originBranch.productionBranch}` : null,
          originBranch.homologationBranch
            ? `- Homologação: ${originBranch.homologationBranch}`
            : null,
          "- (resolvido a partir do repositório vinculado)",
        ]
          .filter(Boolean)
          .join("\n")
      : "- (informar manualmente — nenhum repositório vinculado a esta demanda ainda)";

  return [
    "# Branch de Origem",
    branchLines,
    "",
    "# Tecnologias",
    technologies ? `- ${technologies}` : "- ",
  ].join("\n");
}

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  GENERATED: "neutral",
  APPROVED: "success",
  REJECTED: "danger",
  SUPERSEDED: "warning",
};

/** display labels for `SpecificationVersion.status` — underlying value stays untouched. */
const SPEC_VERSION_STATUS_LABELS: Record<string, string> = {
  GENERATED: "Gerada",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  SUPERSEDED: "Substituída",
};

function specVersionStatusLabel(status: string): string {
  return SPEC_VERSION_STATUS_LABELS[status] ?? status;
}

/** display labels for `SpecificationVersion.source` — underlying value stays untouched. */
const SPEC_VERSION_SOURCE_LABELS: Record<string, string> = {
  AI: "IA",
  HUMAN_EDITED: "Editado manualmente",
  UPLOADED: "Anexado",
};

function specVersionSourceLabel(source: string): string {
  return SPEC_VERSION_SOURCE_LABELS[source] ?? source;
}

const EXECUTION_STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  QUEUED: "neutral",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

const WIZARD_STEPS = [
  "Informações",
  "Sistemas e Artefatos",
  "Prompt SPEC",
  "Anexar arquivos",
  "Revisão",
] as const;

const textareaClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * spec User Story 1: wizard de 5 etapas — Informações de negócio/técnicas →
 * Sistemas e Artefatos Envolvidos → Prompt SPEC (gerado automaticamente a
 * partir das etapas anteriores) → Anexar arquivos prontos → Revisão (SPEC
 * + PLAN lado a lado, aprovar / aprovar e disparar o Developer Agent).
 * follow-up: era uma tela única com rolagem longa; virou wizard por pedido do usuário,
 * com navegação livre entre etapas (todas ficam montadas, só escondidas
 * via CSS, pra não perder seleção não salva ao navegar) e duas ações
 * sempre acessíveis no topo (Histórico de versões, Outros documentos).
 * "Editar diretamente" (editor de texto livre) foi removido — edição
 * direta agora só acontece via "Anexar arquivos prontos" (etapa 4).
 */
export function SpecificationWorkspace() {
  const { specificationId } = useParams<{ specificationId: string }>();
  const { hasPermission } = useAuth();
  const { data: specification } = useSpecification(specificationId ?? "");
  const uploadVersion = useUploadSpecificationVersion(specificationId ?? "");
  const demandId = specification?.demandId ?? "";
  const { data: demand } = useDemand(demandId);
  const { data: projectTechnologies } = useProjectTechnologies(demand?.projectId ?? "");
  const { data: originBranch } = useQuery({
    queryKey: ["demand", demandId, "origin-branch"],
    queryFn: () => apiGet<OriginBranch>(`/demands/${demandId}/origin-branch`),
    enabled: !!demandId,
  });

  const [step, setStep] = useState(0);
  const [businessText, setBusinessText] = useState("");
  const [technicalText, setTechnicalText] = useState("");
  const [technicalTextTouched, setTechnicalTextTouched] = useState(false);

  // feature 003 follow-up: pre-fill the technical input with a # Branch de
  // Origem / # Tecnologias scaffold (the project's technologies, FR-016)
  // instead of a blank field — only once, and never once the analyst has
  // started editing the field.
  useEffect(() => {
    if (technicalTextTouched || !projectTechnologies) return;
    const techList = projectTechnologies
      .map((t) => (t.techVersion ? `${t.name} ${t.techVersion}` : t.name))
      .join(", ");
    setTechnicalText(buildTechnicalTemplate(techList, originBranch));
  }, [projectTechnologies, originBranch, technicalTextTouched]);

  if (!specificationId) return <p className="text-sm text-muted-foreground">Nenhuma especificação selecionada.</p>;
  if (!specification) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  async function handleUpload(specifyMarkdown: string, planMarkdown: string) {
    await uploadVersion.mutateAsync({ specifyMarkdown, planMarkdown, reason: "Enviado de fonte externa" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Especificação Assistida — {specification.documentType}
        </h1>
        <div className="flex items-center gap-2">
          <VersionHistoryButton specificationId={specificationId} hasPermission={hasPermission} />
          {demandId && (
            <SiblingDocumentsButton demandId={demandId} currentSpecificationId={specificationId} />
          )}
        </div>
      </div>

      <WizardSteps current={step} onJump={setStep} />

      <div style={{ display: step === 0 ? undefined : "none" }} className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Informações de negócio</h2>
          <textarea
            placeholder="O que precisa ser feito, problema, objetivo, contexto, regras de negócio conhecidas, fluxos, critérios de aceite, restrições, observações"
            rows={8}
            value={businessText}
            onChange={(e) => setBusinessText(e.target.value)}
            className={textareaClass}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Insumos técnicos</h2>
          <textarea
            placeholder="Telas/APIs/serviços/componentes/banco envolvidos, repositórios, observações técnicas"
            rows={6}
            value={technicalText}
            onChange={(e) => {
              setTechnicalTextTouched(true);
              setTechnicalText(e.target.value);
            }}
            className={textareaClass}
          />
        </section>
      </div>

      <div style={{ display: step === 1 ? undefined : "none" }}>
        {demandId && <SystemSelection demandId={demandId} />}
      </div>

      <div style={{ display: step === 2 ? undefined : "none" }}>
        {demandId && (
          <PromptSpecPanel
            demandId={demandId}
            business={businessText}
            technical={technicalText}
            active={step === 2}
          />
        )}
      </div>

      <div style={{ display: step === 3 ? undefined : "none" }}>
        {hasPermission("SPECIFICATION_WRITE") && <UploadPanel onUpload={handleUpload} />}
      </div>

      <div style={{ display: step === 4 ? undefined : "none" }}>{demandId && <ReviewStep demandId={demandId} />}</div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            <ChevronLeft /> Voltar
          </Button>
        ) : (
          <span />
        )}
        {step < WIZARD_STEPS.length - 1 && (
          <Button type="button" onClick={() => setStep(step + 1)}>
            Avançar <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function WizardSteps({ current, onJump }: { current: number; onJump: (step: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4">
      {WIZARD_STEPS.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onJump(index)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            index === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          Parte {index + 1}: {label}
        </button>
      ))}
    </div>
  );
}

/**
 * follow-up: Version history was an always-visible section on the page —
 * now a self-contained button + modal (grid, still with icon actions;
 * "Editar diretamente" was removed, so the ✎ action opens a read-only
 * viewer instead of an editable draft).
 */
function VersionHistoryButton({
  specificationId,
  hasPermission,
}: {
  specificationId: string;
  hasPermission: (permission: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: versions } = useSpecificationVersionsList(specificationId);
  const approveVersion = useApproveSpecificationVersion(specificationId);
  const restoreVersion = useRestoreSpecificationVersion(specificationId);
  const deactivateVersion = useDeactivateSpecificationVersion(specificationId);
  const [viewingVersion, setViewingVersion] = useState<SpecificationVersion | null>(null);
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);
  const { data: diff } = useSpecificationDiff(
    specificationId,
    diffPair?.[0] ?? null,
    diffPair?.[1] ?? null,
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Histórico de versões
      </Button>
      <Modal title="Histórico de versões" isOpen={isOpen} onClose={() => setIsOpen(false)} className="modal-wide">
        <DataTable
          columns={versionColumns(
            versions?.length ?? 0,
            hasPermission,
            setViewingVersion,
            (v) => approveVersion.mutate({ versionNumber: v.versionNumber }),
            (v) => restoreVersion.mutate(v.versionNumber),
            (v) => setDiffPair([v.versionNumber - 1, v.versionNumber]),
            (v) => deactivateVersion.mutate(v.versionNumber),
          )}
          data={versions ?? []}
          emptyMessage="Nenhuma versão ainda."
        />
        {diff && (
          <section className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Diff</h3>
            <DiffView additions={diff.additions} deletions={diff.deletions} />
          </section>
        )}
      </Modal>
      {viewingVersion && (
        <Modal
          title={`Versão v${viewingVersion.versionNumber}`}
          isOpen
          onClose={() => setViewingVersion(null)}
          className="modal-wide"
        >
          <MarkdownEditor value={viewingVersion.content} onChange={() => {}} readOnly />
        </Modal>
      )}
    </>
  );
}

/**
 * follow-up: Version history was a plain text list with text-labeled
 * buttons ("Aprovar"/"Restore"/"Diff vs previous") — now a grid, actions as
 * icon buttons.
 */
function versionColumns(
  totalVersions: number,
  hasPermission: (permission: string) => boolean,
  onView: (version: SpecificationVersion) => void,
  onApprove: (version: SpecificationVersion) => void,
  onRestore: (version: SpecificationVersion) => void,
  onDiff: (version: SpecificationVersion) => void,
  onDelete: (version: SpecificationVersion) => void,
): ColumnDef<SpecificationVersion, unknown>[] {
  return [
    { header: "Versão", accessorFn: (v) => `v${v.versionNumber}` },
    { header: "Motivo", accessorFn: (v) => v.reason ?? "—" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge label={specVersionStatusLabel(row.original.status)} tone={STATUS_TONE[row.original.status] ?? "neutral"} />
      ),
    },
    {
      header: "Origem",
      cell: ({ row }) => <Badge label={specVersionSourceLabel(row.original.source)} tone="neutral" />,
    },
    {
      header: "Ações",
      cell: ({ row }) => {
        const v = row.original;
        return (
          <span className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-8" title="Visualizar" aria-label="Visualizar" onClick={() => onView(v)}>
              <Eye className="size-4" />
            </Button>
            {v.status !== "APPROVED" && hasPermission("SPECIFICATION_APPROVE") && (
              <Button type="button" variant="ghost" size="icon" className="size-8" title="Aprovar" aria-label="Aprovar" onClick={() => onApprove(v)}>
                <Check className="size-4" />
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" className="size-8" title="Restaurar" aria-label="Restaurar" onClick={() => onRestore(v)}>
              <RotateCcw className="size-4" />
            </Button>
            {totalVersions > 1 && v.versionNumber > 1 && (
              <Button type="button" variant="ghost" size="icon" className="size-8" title="Diff vs anterior" aria-label="Diff vs anterior" onClick={() => onDiff(v)}>
                <ArrowLeftRight className="size-4" />
              </Button>
            )}
            {v.status !== "APPROVED" && hasPermission("SPECIFICATION_WRITE") && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                title="Excluir versão"
                aria-label="Excluir versão"
                onClick={() => {
                  if (window.confirm(`Excluir a versão v${v.versionNumber}? Essa ação não pode ser desfeita.`)) {
                    onDelete(v);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </span>
        );
      },
    },
  ];
}

/**
 * follow-up: the analyst approves both SPEC and PLAN documents but each
 * lives on its own `/specifications/:id` page — there was no way to peek at
 * the OTHER document's approved content without navigating away and losing
 * the current draft. Button + list modal; picking one closes the list and
 * opens its content read-only (never both modals stacked at once).
 */
function SiblingDocumentsButton({
  demandId,
  currentSpecificationId,
}: {
  demandId: string;
  currentSpecificationId: string;
}) {
  const { data: specifications } = useQuery({
    queryKey: ["demand", demandId, "specifications"],
    queryFn: () => apiGet<Specification[]>(`/demands/${demandId}/specifications`),
    enabled: !!demandId,
  });
  const [isListOpen, setIsListOpen] = useState(false);
  const [viewingSpecId, setViewingSpecId] = useState<string | null>(null);
  const siblings = (specifications ?? []).filter(
    (s) => s.id !== currentSpecificationId && s.currentVersionId,
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsListOpen(true)}>
        Outros documentos
      </Button>
      <Modal title="Outros documentos desta demanda" isOpen={isListOpen} onClose={() => setIsListOpen(false)}>
        <DataTable
          columns={siblingDocumentColumns((s) => {
            setIsListOpen(false);
            setViewingSpecId(s.id);
          })}
          data={siblings}
          emptyMessage="Nenhum outro documento aprovado ainda."
        />
      </Modal>
      {viewingSpecId && (
        <SiblingDocumentModal specificationId={viewingSpecId} onClose={() => setViewingSpecId(null)} />
      )}
    </>
  );
}

/** follow-up: "Outros documentos" was a plain text list ("Visualizar" as a text button) — now a grid with an icon-button action. */
function siblingDocumentColumns(onView: (specification: Specification) => void): ColumnDef<Specification, unknown>[] {
  return [
    { header: "Documento", accessorKey: "documentType" },
    {
      header: "Ações",
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Visualizar"
            aria-label="Visualizar"
            onClick={() => onView(row.original)}
          >
            <Eye className="size-4" />
          </Button>
        </span>
      ),
    },
  ];
}

function SiblingDocumentModal({
  specificationId,
  onClose,
}: {
  specificationId: string;
  onClose: () => void;
}) {
  const { data: versions } = useSpecificationVersionsList(specificationId);
  const latest = versions?.[versions.length - 1];
  return (
    <Modal title="Visualizar documento" isOpen onClose={onClose} className="modal-wide">
      {latest ? (
        <MarkdownEditor value={latest.content} onChange={() => {}} readOnly />
      ) : (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}
    </Modal>
  );
}

/**
 * feature 005 User Story 3 (FR-007-FR-010): seleção de Sistemas — restrita
 * aos associados ao Cliente da demanda — e, por Sistema selecionado, seus
 * Artefatos ativos.
 */
function SystemSelection({ demandId }: { demandId: string }) {
  const { hasPermission } = useAuth();
  const { data: systemsData } = useDemandSystems(demandId);
  const setSystems = useSetDemandSystems(demandId);
  const setArtifacts = useSetDemandSystemArtifacts(demandId);

  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);
  // Kept as full objects (not just ids) so already-selected Artefatos still
  // show their name/type even when they're not part of the current search
  // results — a Sistema can carry hundreds of Artefatos (real case: ~300),
  // so "available" is a capped/searched slice, never the full set.
  const [selectedArtifacts, setSelectedArtifacts] = useState<SystemArtifact[]>([]);
  const [artifactSearch, setArtifactSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { data: artifactsData } = useDemandSystemArtifacts(demandId, debouncedSearch, selectedSystemIds);

  useEffect(() => {
    if (systemsData) setSelectedSystemIds(systemsData.selected.map((s) => s.id));
  }, [systemsData]);
  // Only seeds from the server once per demand — afterwards this state is
  // the source of truth (see toggle/save below). Keyed by demandId (not by
  // "length === 0") so removing the last selected Artefato doesn't get
  // immediately overwritten by the still-cached server selection.
  const seededArtifactsFor = useRef<string | null>(null);
  useEffect(() => {
    if (artifactsData && seededArtifactsFor.current !== demandId) {
      setSelectedArtifacts(artifactsData.selected);
      seededArtifactsFor.current = demandId;
    }
  }, [artifactsData, demandId]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(artifactSearch), 300);
    return () => clearTimeout(timeout);
  }, [artifactSearch]);

  const canWrite = hasPermission("DEMAND_SYSTEM_WRITE");
  const selectedArtifactIds = new Set(selectedArtifacts.map((a) => a.id));

  function toggleSystem(id: string) {
    setSelectedSystemIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  }

  function addArtifact(artifact: SystemArtifact) {
    setSelectedArtifacts((current) =>
      current.some((a) => a.id === artifact.id) ? current : [...current, artifact],
    );
    // clears the filter (not the open state) so the dropdown keeps showing
    // fresh results and the field stays focused for the next pick — supports
    // adding several Artefatos in a row without reopening the dropdown
    setArtifactSearch("");
  }

  function removeArtifact(id: string) {
    setSelectedArtifacts((current) => current.filter((a) => a.id !== id));
  }

  async function saveSelection() {
    setSaveMessage(null);
    await setSystems.mutateAsync(selectedSystemIds);
    await setArtifacts.mutateAsync(selectedArtifacts.map((a) => a.id));
    setSaveMessage("Seleção salva com sucesso.");
  }

  const availableArtifacts =
    artifactsData?.available.filter((a) => !selectedArtifactIds.has(a.id)) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Sistemas e Artefatos Envolvidos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione quais Sistemas do Cliente desta demanda estão envolvidos — para cada um marcado, os
          Artefatos ativos ficam disponíveis para seleção abaixo.
        </p>
      </div>
      {!systemsData?.available.length && (
        <p className="text-sm text-muted-foreground">Nenhum Sistema associado a este Cliente.</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {systemsData?.available.map((system) => {
          const isSelected = selectedSystemIds.includes(system.id);
          return (
            <label
              key={system.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                isSelected ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSystem(system.id)}
                disabled={!canWrite}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sistema
                </span>
                <span className="text-sm font-semibold text-foreground">{system.name}</span>
                {system.description && (
                  <span className="text-xs text-muted-foreground">{system.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {selectedSystemIds.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-foreground">Artefatos selecionados</h3>
          {selectedArtifacts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum artefato selecionado ainda.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {selectedArtifacts.map((artifact) => (
              <span
                key={artifact.id}
                className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {artifact.name} ({artifact.type})
                {canWrite && (
                  <button
                    type="button"
                    title="Remover"
                    aria-label={`Remover ${artifact.name}`}
                    onClick={() => removeArtifact(artifact.id)}
                    className="grid size-4 place-items-center rounded-full bg-transparent text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {canWrite && (
            <div className="relative max-w-md">
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">Adicionar artefato</h3>
              <Input
                type="search"
                placeholder="Buscar por nome…"
                value={artifactSearch}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
                onChange={(e) => {
                  setArtifactSearch(e.target.value);
                  setIsSearchOpen(true);
                }}
              />
              {isSearchOpen && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
                  {availableArtifacts.map((artifact) => (
                    <li key={artifact.id}>
                      {/* preventDefault keeps the input focused (no blur) so the dropdown
                          stays open and the field stays filterable across multiple picks */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addArtifact(artifact);
                        }}
                        className="w-full rounded-none bg-transparent px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent"
                      >
                        {artifact.name} ({artifact.type})
                      </button>
                    </li>
                  ))}
                  {artifactsData && availableArtifacts.length === 0 && (
                    <li className="px-3 py-1.5 text-sm text-muted-foreground">
                      {artifactSearch ? "Nenhum artefato encontrado." : "Nenhum artefato disponível."}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {canWrite && (
        <Button
          type="button"
          onClick={saveSelection}
          disabled={setSystems.isPending || setArtifacts.isPending}
          className="self-start"
        >
          Salvar seleção
        </Button>
      )}
      {saveMessage && <p className="text-sm font-medium text-success">{saveMessage}</p>}
    </section>
  );
}

/**
 * feature 005 User Story 4 (FR-014-FR-019): substitui o "Enviar para IA" —
 * consolida negócio/técnico/Cliente/Sistemas/Artefatos no template
 * `prompt-spec-kit.md`, exibe o resultado e permite copiar. Nenhuma chamada
 * de LLM ocorre aqui (FR-018). follow-up: `active` (true quando esta é a
 * etapa 3 do wizard atual) dispara geração automática ao entrar na etapa —
 * "já vem gerado conforme etapas anteriores" — mantendo o botão pra
 * regenerar manualmente caso o analista volte e mude algo.
 */
function PromptSpecPanel({
  demandId,
  business,
  technical,
  active,
}: {
  demandId: string;
  business: string;
  technical: string;
  active: boolean;
}) {
  const { hasPermission } = useAuth();
  const generatePrompt = useGeneratePromptSpec(demandId);
  const [copied, setCopied] = useState(false);
  const generatedForStep = useRef(false);

  async function generate() {
    setCopied(false);
    await generatePrompt.mutateAsync({ business, technical });
  }

  useEffect(() => {
    if (active && !generatedForStep.current && hasPermission("SPEC_PROMPT_GENERATE")) {
      generatedForStep.current = true;
      void generate();
    }
    if (!active) generatedForStep.current = false;
  }, [active]);

  async function copyPrompt() {
    if (!generatePrompt.data) return;
    await navigator.clipboard.writeText(generatePrompt.data.prompt);
    setCopied(true);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Prompt SPEC</h2>
      {hasPermission("SPEC_PROMPT_GENERATE") && (
        <Button type="button" variant="outline" onClick={generate} disabled={generatePrompt.isPending} className="self-start">
          <Sparkles /> {generatePrompt.data ? "Regenerar Prompt SPEC" : "Gerar Prompt SPEC"}
        </Button>
      )}
      {generatePrompt.data && (
        <>
          <textarea readOnly rows={16} value={generatePrompt.data.prompt} className={cn(textareaClass, "font-mono text-xs")} />
          <div className="flex items-center gap-2">
            <Button type="button" onClick={copyPrompt} className="self-start">
              <Copy /> Copiar Prompt
            </Button>
            {copied && <span className="text-sm text-success">Copiado!</span>}
          </div>
        </>
      )}
    </section>
  );
}

/** follow-up: reads a dropped/selected .md file's text content into the field — kept alongside the paste-text textarea, not instead of it. */
function FileDropField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    onChange(await file.text());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors",
          isDragging ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void readFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          hidden
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
        <p>Arraste o arquivo .md aqui ou clique para selecionar</p>
      </div>
      <textarea
        placeholder={placeholder}
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={textareaClass}
      />
    </div>
  );
}

function UploadPanel({
  onUpload,
}: {
  onUpload: (specifyMarkdown: string, planMarkdown: string) => Promise<void>;
}) {
  const [specifyMarkdown, setSpecifyMarkdown] = useState("");
  const [planMarkdown, setPlanMarkdown] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await onUpload(specifyMarkdown, planMarkdown);
      setMessage("Arquivos anexados com sucesso.");
    } catch (err) {
      setError(errorMessage(err, "Falha ao anexar os arquivos."));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Anexar arquivos prontos</h2>
      <FileDropField
        label="specify.md"
        placeholder="Ou cole o conteúdo de specify.md aqui"
        value={specifyMarkdown}
        onChange={setSpecifyMarkdown}
      />
      <FileDropField
        label="plan.md"
        placeholder="Ou cole o conteúdo de plan.md aqui"
        value={planMarkdown}
        onChange={setPlanMarkdown}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {message && <p className="text-sm font-medium text-success">{message}</p>}
      <Button
        type="button"
        onClick={handleClick}
        disabled={isBusy || (!specifyMarkdown.trim() && !planMarkdown.trim())}
        className="self-start"
      >
        <Upload /> Anexar
      </Button>
    </section>
  );
}

/**
 * follow-up (Parte 5): as duas especificações finais (SPEC + PLAN) lado a
 * lado, somente leitura, com duas ações — "Aprovar" aprova a última versão
 * de cada documento (pulando o que já estiver APPROVED); "Aprovar e
 * executar" faz o mesmo e em seguida dispara o Developer Agent pra essa
 * demanda (mesmo endpoint que a tela Agents usa). Conhecido: se o conteúdo
 * só veio de "Anexar arquivos prontos" (nunca rodou /speckit-specify de
 * verdade), o workspace não tem `specs/<NNN>/spec.md` ainda — o Developer
 * Agent roda mas o Claude Code corretamente reporta que não há nada pra
 * implementar, igual observado em validação ao vivo desta sessão.
 */
function ReviewStep({ demandId }: { demandId: string }) {
  const queryClient = useQueryClient();
  const { data: specifications } = useQuery({
    queryKey: ["demand", demandId, "specifications"],
    queryFn: () => apiGet<Specification[]>(`/demands/${demandId}/specifications`),
    enabled: !!demandId,
  });
  const specDoc = specifications?.find((s) => s.documentType === "SPEC");
  const planDoc = specifications?.find((s) => s.documentType === "PLAN");
  const { data: specVersions } = useSpecificationVersionsList(specDoc?.id ?? "");
  const { data: planVersions } = useSpecificationVersionsList(planDoc?.id ?? "");
  // follow-up: a new Incremento (ex. "Novas necessidades") used to visually
  // "inherit" whatever was last approved in the PREVIOUS incremento — the
  // review step always showed the latest version overall, with no notion of
  // incremento boundaries. Now scoped to the demand's current incremento:
  // no version tagged with that incrementId yet → treated as blank, not
  // filled with stale content.
  const { data: increments } = useIncrementsList(demandId);
  const currentIncrement = increments?.[increments.length - 1];
  const specLatest = specVersions
    ?.filter((v) => v.incrementId === currentIncrement?.id)
    .at(-1);
  const planLatest = planVersions
    ?.filter((v) => v.incrementId === currentIncrement?.id)
    .at(-1);
  // `baseSpecificationVersionId` only ever references ONE of SPEC/PLAN (see
  // IncrementsService.createNext) — searched in both unfiltered lists, so
  // "Ver versão base" only renders on whichever side it actually belongs to.
  const specBaseVersion = specVersions?.find((v) => v.id === currentIncrement?.baseSpecificationVersionId);
  const planBaseVersion = planVersions?.find((v) => v.id === currentIncrement?.baseSpecificationVersionId);
  const [viewingBaseVersion, setViewingBaseVersion] = useState<SpecificationVersion | null>(null);

  const { data: agents } = useAgentsList();
  const triggerExecution = useTriggerExecution();

  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // follow-up: "Aprovar e executar" used to just show one static success
  // message and leave the analyst with no visibility into what happened
  // next — the Developer Agent run takes several minutes. Tracks the
  // triggered execution's id so its live status/current step can be shown
  // right here (same polling hook the Executions page uses).
  const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null);
  const runningExecution = useExecution(runningExecutionId);

  async function approveLatestVersions() {
    const jobs: Promise<unknown>[] = [];
    if (specDoc && specLatest && specLatest.status !== "APPROVED") {
      jobs.push(apiPost(`/specifications/${specDoc.id}/versions/${specLatest.versionNumber}/approve`, {}));
    }
    if (planDoc && planLatest && planLatest.status !== "APPROVED") {
      jobs.push(apiPost(`/specifications/${planDoc.id}/versions/${planLatest.versionNumber}/approve`, {}));
    }
    await Promise.all(jobs);
    await queryClient.invalidateQueries({ queryKey: ["specification"] });
  }

  async function handleApprove() {
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await approveLatestVersions();
      setMessage("Especificações aprovadas.");
    } catch (err) {
      setError(errorMessage(err, "Falha ao aprovar as especificações."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleApproveAndExecute() {
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await approveLatestVersions();
      const developerAgent = agents?.find((a) => a.type === "developer");
      if (!developerAgent) {
        throw new Error("Nenhum agente do tipo \"developer\" cadastrado.");
      }
      const execution = await triggerExecution.mutateAsync({ agentId: developerAgent.id, demandId });
      setRunningExecutionId(execution.id);
      setMessage("Especificações aprovadas e execução do Developer Agent disparada.");
    } catch (err) {
      setError(errorMessage(err, "Falha ao aprovar e executar."));
    } finally {
      setIsBusy(false);
    }
  }

  const hasAnythingToApprove =
    (!!specLatest && specLatest.status !== "APPROVED") || (!!planLatest && planLatest.status !== "APPROVED");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        Revisão
        {currentIncrement && <span className="text-muted-foreground">— Incremento {currentIncrement.number}</span>}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            SPEC {specLatest && <Badge label={specVersionStatusLabel(specLatest.status)} tone={STATUS_TONE[specLatest.status] ?? "neutral"} />}
          </h3>
          {specLatest ? (
            <MarkdownEditor value={specLatest.content} onChange={() => {}} readOnly />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada ainda neste incremento.</p>
              {specBaseVersion && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setViewingBaseVersion(specBaseVersion)}>
                  Ver versão base
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            PLAN {planLatest && <Badge label={specVersionStatusLabel(planLatest.status)} tone={STATUS_TONE[planLatest.status] ?? "neutral"} />}
          </h3>
          {planLatest ? (
            <MarkdownEditor value={planLatest.content} onChange={() => {}} readOnly />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada ainda neste incremento.</p>
              {planBaseVersion && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setViewingBaseVersion(planBaseVersion)}>
                  Ver versão base
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {viewingBaseVersion && (
        <Modal
          title="Versão base do incremento"
          isOpen
          onClose={() => setViewingBaseVersion(null)}
          className="modal-wide"
        >
          <MarkdownEditor value={viewingBaseVersion.content} onChange={() => {}} readOnly />
        </Modal>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {message && <p className="text-sm font-medium text-success">{message}</p>}
      {runningExecution.data && (
        <p className="flex items-center gap-2 text-sm text-foreground">
          Execução do Developer Agent:{" "}
          <Badge
            label={executionStatusLabel(runningExecution.data.status)}
            tone={EXECUTION_STATUS_TONE[runningExecution.data.status] ?? "neutral"}
          />
          {runningExecution.data.status === "RUNNING" &&
            pipelineStageLabel(runningExecution.data.pipelineStage) && (
              <span className="text-muted-foreground">— {pipelineStageLabel(runningExecution.data.pipelineStage)}</span>
            )}
          {runningExecution.data.status === "FAILED" && runningExecution.data.error && (
            <span className="font-medium text-destructive"> — {runningExecution.data.error}</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={handleApprove} disabled={isBusy || !hasAnythingToApprove}>
          Aprovar
        </Button>
        <Button type="button" onClick={handleApproveAndExecute} disabled={isBusy || !specLatest || !planLatest}>
          Aprovar e executar
        </Button>
      </div>
    </section>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = (error.body as { message?: string })?.message;
    return message ?? `A requisição falhou (${error.status}). Tente recarregar a página.`;
  }
  return error instanceof Error ? error.message : fallback;
}
