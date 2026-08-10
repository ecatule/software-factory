import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MarkdownEditor, DiffView, Badge } from "@software-factory/ui";
import { apiGet } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSpecification } from "../services/useSpecificationVersions";
import {
  useApproveSpecificationVersion,
  useCreateSpecificationVersion,
  useRestoreSpecificationVersion,
  useSpecificationDiff,
  useSpecificationVersionsList,
  useUploadSpecificationVersion,
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

interface OriginBranch {
  productionBranch: string | null;
  homologationBranch: string | null;
  source: "repository" | "project" | null;
}

/**
 * spec FR-002 (technical inputs) + spec 004 FR-003: a starting scaffold so
 * the analyst edits/completes sections instead of writing from a blank
 * page. "Branch de Origem" is now resolved automatically from the
 * repository backing the demand's known artifacts, or the project's own
 * branch fields (feature 004) — previously a manual-only placeholder.
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
          `- (resolvido a partir do ${originBranch.source === "repository" ? "repositório vinculado" : "projeto"})`,
        ]
          .filter(Boolean)
          .join("\n")
      : "- (informar manualmente — nenhum branch cadastrado no projeto/repositório ainda)";

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

/**
 * spec User Story 1: business/technical input → seleção de Sistemas/Artefatos →
 * "Gerar Prompt SPEC" (feature 005) → copiar manualmente para a IA de preferência.
 * O envio direto para IA (specification_copilot) saiu desta tela — FR-019,
 * feature 005 Assumptions: o código continua existindo, só não é mais
 * alcançado a partir daqui (ainda disparável via Agents.tsx).
 */
export function SpecificationWorkspace() {
  const { specificationId } = useParams<{ specificationId: string }>();
  const { hasPermission } = useAuth();
  const { data: specification } = useSpecification(specificationId ?? "");
  const { data: versions } = useSpecificationVersionsList(specificationId ?? "");
  const createVersion = useCreateSpecificationVersion(specificationId ?? "");
  const restoreVersion = useRestoreSpecificationVersion(specificationId ?? "");
  const approveVersion = useApproveSpecificationVersion(specificationId ?? "");
  const uploadVersion = useUploadSpecificationVersion(specificationId ?? "");
  const demandId = specification?.demandId ?? "";
  const { data: demand } = useDemand(demandId);
  const { data: projectTechnologies } = useProjectTechnologies(demand?.projectId ?? "");
  const { data: originBranch } = useQuery({
    queryKey: ["demand", demandId, "origin-branch"],
    queryFn: () => apiGet<OriginBranch>(`/demands/${demandId}/origin-branch`),
    enabled: !!demandId,
  });

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

  const [draft, setDraft] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);
  const { data: diff } = useSpecificationDiff(
    specificationId ?? "",
    diffPair?.[0] ?? null,
    diffPair?.[1] ?? null,
  );

  if (!specificationId) return <p>No specification selected.</p>;
  if (!versions || !specification) return <p>Loading…</p>;

  const latest = versions[versions.length - 1];
  const content = draft ?? latest?.content ?? "";

  async function saveDraft() {
    if (draft === null) return;
    await createVersion.mutateAsync({ content: draft, reason: "Edited via console" });
    setDraft(null);
  }

  async function handleUpload(specifyMarkdown: string, planMarkdown: string) {
    await uploadVersion.mutateAsync({ specifyMarkdown, planMarkdown, reason: "Uploaded from external source" });
  }

  return (
    <div className="specification-workspace-page">
      <h1>Especificação Assistida — {specification.documentType}</h1>

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

      {demandId && <SystemSelection demandId={demandId} />}

      {demandId && <PromptSpecPanel demandId={demandId} business={businessText} technical={technicalText} />}

      <section>
        <h2>Editar diretamente</h2>
        <MarkdownEditor value={content} onChange={setDraft} />
        {hasPermission("SPECIFICATION_WRITE") && (
          <button type="button" onClick={saveDraft} disabled={draft === null}>
            Save new version
          </button>
        )}
      </section>

      {hasPermission("SPECIFICATION_WRITE") && <UploadPanel onUpload={handleUpload} />}

      <section>
        <h2>Version history</h2>
        <ul>
          {versions.map((v) => (
            <li key={v.id}>
              v{v.versionNumber} — {v.reason ?? "no reason recorded"}{" "}
              <Badge label={v.status} tone={STATUS_TONE[v.status] ?? "neutral"} />{" "}
              <Badge label={v.source} tone="neutral" />
              {v.status !== "APPROVED" && hasPermission("SPECIFICATION_APPROVE") && (
                <button type="button" onClick={() => approveVersion.mutate({ versionNumber: v.versionNumber })}>
                  Aprovar
                </button>
              )}
              <button type="button" onClick={() => restoreVersion.mutate(v.versionNumber)}>
                Restore
              </button>
              {versions.length > 1 && v.versionNumber > 1 && (
                <button
                  type="button"
                  onClick={() => setDiffPair([v.versionNumber - 1, v.versionNumber])}
                >
                  Diff vs previous
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {diff && (
        <section>
          <h2>Diff</h2>
          <DiffView additions={diff.additions} deletions={diff.deletions} />
        </section>
      )}
    </div>
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
 * de LLM ocorre aqui (FR-018).
 */
function PromptSpecPanel({
  demandId,
  business,
  technical,
}: {
  demandId: string;
  business: string;
  technical: string;
}) {
  const { hasPermission } = useAuth();
  const generatePrompt = useGeneratePromptSpec(demandId);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setCopied(false);
    await generatePrompt.mutateAsync({ business, technical });
  }

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
          Gerar Prompt SPEC
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
      <textarea
        placeholder="Conteúdo de specify.md"
        rows={6}
        value={specifyMarkdown}
        onChange={(e) => setSpecifyMarkdown(e.target.value)}
      />
      <textarea
        placeholder="Conteúdo de plan.md"
        rows={6}
        value={planMarkdown}
        onChange={(e) => setPlanMarkdown(e.target.value)}
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
