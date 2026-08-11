import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MarkdownEditor, DiffView, Badge, DataTable, Modal } from "@software-factory/ui";
import { apiGet } from "../services/api";
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

const WIZARD_STEPS = [
  "Informações",
  "Sistemas e Artefatos",
  "Prompt SPEC",
  "Anexar arquivos",
] as const;

/**
 * spec User Story 1: wizard de 4 etapas — Informações de negócio/técnicas →
 * Sistemas e Artefatos Envolvidos → Prompt SPEC (gerado automaticamente a
 * partir das etapas anteriores) → Anexar arquivos prontos. follow-up: era
 * uma tela única com rolagem longa; virou wizard por pedido do usuário,
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

  if (!specificationId) return <p>No specification selected.</p>;
  if (!specification) return <p>Loading…</p>;

  async function handleUpload(specifyMarkdown: string, planMarkdown: string) {
    await uploadVersion.mutateAsync({ specifyMarkdown, planMarkdown, reason: "Uploaded from external source" });
  }

  return (
    <div className="specification-workspace-page">
      <h1>Especificação Assistida — {specification.documentType}</h1>

      <div className="wizard-header-actions">
        <VersionHistoryButton specificationId={specificationId} hasPermission={hasPermission} />
        {demandId && (
          <SiblingDocumentsButton demandId={demandId} currentSpecificationId={specificationId} />
        )}
      </div>

      <WizardSteps current={step} onJump={setStep} />

      <div style={{ display: step === 0 ? undefined : "none" }}>
        <section>
          <h2>Informações de negócio</h2>
          <textarea
            placeholder="O que precisa ser feito, problema, objetivo, contexto, regras de negócio conhecidas, fluxos, critérios de aceite, restrições, observações"
            rows={8}
            value={businessText}
            onChange={(e) => setBusinessText(e.target.value)}
          />
        </section>

        <section>
          <h2>Insumos técnicos</h2>
          <textarea
            placeholder="Telas/APIs/serviços/componentes/banco envolvidos, repositórios, observações técnicas"
            rows={6}
            value={technicalText}
            onChange={(e) => {
              setTechnicalTextTouched(true);
              setTechnicalText(e.target.value);
            }}
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

      <div className="wizard-nav">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)}>
            ← Voltar
          </button>
        ) : (
          <span />
        )}
        {step < WIZARD_STEPS.length - 1 && (
          <button type="button" onClick={() => setStep(step + 1)}>
            Avançar →
          </button>
        )}
      </div>
    </div>
  );
}

function WizardSteps({ current, onJump }: { current: number; onJump: (step: number) => void }) {
  return (
    <div className="wizard-steps">
      {WIZARD_STEPS.map((label, index) => (
        <button
          key={label}
          type="button"
          className={index === current ? "wizard-step wizard-step-active" : "wizard-step"}
          onClick={() => onJump(index)}
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
      <button type="button" onClick={() => setIsOpen(true)}>
        Histórico de versões
      </button>
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
          emptyMessage="No versions yet."
        />
        {diff && (
          <section>
            <h3>Diff</h3>
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
 * icon buttons (same `.icon-button`/`.icon-actions` convention as the
 * Systems Artefatos grid).
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
      cell: ({ row }) => <Badge label={row.original.status} tone={STATUS_TONE[row.original.status] ?? "neutral"} />,
    },
    { header: "Origem", cell: ({ row }) => <Badge label={row.original.source} tone="neutral" /> },
    {
      header: "Ações",
      cell: ({ row }) => {
        const v = row.original;
        return (
          <span className="icon-actions">
            <button type="button" className="icon-button" title="Visualizar" aria-label="Visualizar" onClick={() => onView(v)}>
              👁
            </button>
            {v.status !== "APPROVED" && hasPermission("SPECIFICATION_APPROVE") && (
              <button type="button" className="icon-button" title="Aprovar" aria-label="Aprovar" onClick={() => onApprove(v)}>
                ✓
              </button>
            )}
            <button type="button" className="icon-button" title="Restaurar" aria-label="Restaurar" onClick={() => onRestore(v)}>
              ↺
            </button>
            {totalVersions > 1 && v.versionNumber > 1 && (
              <button type="button" className="icon-button" title="Diff vs anterior" aria-label="Diff vs anterior" onClick={() => onDiff(v)}>
                ⇄
              </button>
            )}
            {v.status !== "APPROVED" && hasPermission("SPECIFICATION_WRITE") && (
              <button
                type="button"
                className="icon-button"
                title="Excluir versão"
                aria-label="Excluir versão"
                onClick={() => {
                  if (window.confirm(`Excluir a versão v${v.versionNumber}? Essa ação não pode ser desfeita.`)) {
                    onDelete(v);
                  }
                }}
              >
                🗑
              </button>
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
      <button type="button" onClick={() => setIsListOpen(true)}>
        Outros documentos
      </button>
      <Modal title="Outros documentos desta demanda" isOpen={isListOpen} onClose={() => setIsListOpen(false)}>
        {siblings.length === 0 && <p>Nenhum outro documento aprovado ainda.</p>}
        <ul>
          {siblings.map((s) => (
            <li key={s.id}>
              {s.documentType}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsListOpen(false);
                  setViewingSpecId(s.id);
                }}
              >
                Visualizar
              </button>
            </li>
          ))}
        </ul>
      </Modal>
      {viewingSpecId && (
        <SiblingDocumentModal specificationId={viewingSpecId} onClose={() => setViewingSpecId(null)} />
      )}
    </>
  );
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
        <p>Carregando…</p>
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

  return (
    <section>
      <h2>Sistemas e Artefatos Envolvidos</h2>
      {!systemsData?.available.length && <p>Nenhum Sistema associado a este Cliente.</p>}
      <ul>
        {systemsData?.available.map((system) => (
          <li key={system.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedSystemIds.includes(system.id)}
                onChange={() => toggleSystem(system.id)}
                disabled={!canWrite}
              />{" "}
              {system.name}
            </label>
          </li>
        ))}
      </ul>

      {selectedSystemIds.length > 0 && (
        <>
          <h3>Artefatos selecionados</h3>
          {selectedArtifacts.length === 0 && <p>Nenhum artefato selecionado ainda.</p>}
          <div className="chip-list">
            {selectedArtifacts.map((artifact) => (
              <span className="chip" key={artifact.id}>
                {artifact.name} ({artifact.type})
                {canWrite && (
                  <button
                    type="button"
                    className="chip-remove"
                    title="Remover"
                    aria-label={`Remover ${artifact.name}`}
                    onClick={() => removeArtifact(artifact.id)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {canWrite && (
            <div className="autocomplete">
              <h3>Adicionar artefato</h3>
              <input
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
                <ul className="autocomplete-dropdown">
                  {artifactsData?.available
                    .filter((a) => !selectedArtifactIds.has(a.id))
                    .map((artifact) => (
                      <li key={artifact.id}>
                        {/* preventDefault keeps the input focused (no blur) so the dropdown
                            stays open and the field stays filterable across multiple picks */}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addArtifact(artifact);
                          }}
                        >
                          {artifact.name} ({artifact.type})
                        </button>
                      </li>
                    ))}
                  {artifactsData && artifactsData.available.filter((a) => !selectedArtifactIds.has(a.id)).length === 0 && (
                    <li className="autocomplete-empty">
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
        <button type="button" onClick={saveSelection} disabled={setSystems.isPending || setArtifacts.isPending}>
          Salvar seleção
        </button>
      )}
      {saveMessage && <p className="form-success">{saveMessage}</p>}
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
    <section>
      <h2>Prompt SPEC</h2>
      {hasPermission("SPEC_PROMPT_GENERATE") && (
        <button type="button" onClick={generate} disabled={generatePrompt.isPending}>
          {generatePrompt.data ? "Regenerar Prompt SPEC" : "Gerar Prompt SPEC"}
        </button>
      )}
      {generatePrompt.data && (
        <>
          <textarea readOnly rows={16} value={generatePrompt.data.prompt} />
          <button type="button" onClick={copyPrompt}>
            Copiar Prompt
          </button>
          {copied && <span> Copiado!</span>}
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
    <div className="form-field">
      <label>{label}</label>
      <div
        className={isDragging ? "file-drop-zone file-drop-zone-active" : "file-drop-zone"}
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
  return (
    <section>
      <h2>Anexar arquivos prontos</h2>
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
      <button
        type="button"
        onClick={() => onUpload(specifyMarkdown, planMarkdown)}
        disabled={!specifyMarkdown.trim() && !planMarkdown.trim()}
      >
        Anexar
      </button>
    </section>
  );
}
