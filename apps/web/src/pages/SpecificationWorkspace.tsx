import { useEffect, useState } from "react";
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
import { useTriggerSpecificationRound } from "../services/useSpecificationCopilot";
import { useExecution } from "../services/useExecutions";
import { useDemand } from "../services/useDemands";
import { useProjectTechnologies } from "../services/useTechnologies";
import type { Artifact, SpecificationProposal } from "../services/types";

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
 */
function buildTechnicalTemplate(
  artifacts: Artifact[] | undefined,
  technologies: string,
  originBranch: OriginBranch | undefined,
): string {
  const isScreen = (a: Artifact) => /tela|screen/i.test(a.type);
  const isApi = (a: Artifact) => /api/i.test(a.type);
  const screens = artifacts?.filter(isScreen).map((a) => `- ${a.name}`).join("\n");
  const apis = artifacts?.filter(isApi).map((a) => `- ${a.name}`).join("\n");

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
    "# Telas",
    screens || "- ",
    "",
    "# APIs",
    apis || "- ",
    "",
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
 * spec User Story 1: business/technical input → async AI round → structured
 * proposal → iterate/edit/upload → compare versions → approve. Replaces the
 * plain-Markdown SpecificationEditor.tsx.
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
  const triggerRound = useTriggerSpecificationRound(specification?.demandId ?? "");
  const { data: demand } = useDemand(specification?.demandId ?? "");
  const { data: projectTechnologies } = useProjectTechnologies(demand?.projectId ?? "");
  const { data: demandArtifacts } = useQuery({
    queryKey: ["demand", specification?.demandId, "artifacts"],
    queryFn: () => apiGet<Artifact[]>(`/demands/${specification?.demandId}/artifacts`),
    enabled: !!specification?.demandId,
  });
  const { data: originBranch } = useQuery({
    queryKey: ["demand", specification?.demandId, "origin-branch"],
    queryFn: () => apiGet<OriginBranch>(`/demands/${specification?.demandId}/origin-branch`),
    enabled: !!specification?.demandId,
  });

  const [businessText, setBusinessText] = useState("");
  const [technicalText, setTechnicalText] = useState("");
  const [technicalTextTouched, setTechnicalTextTouched] = useState(false);

  // feature 003 follow-up: pre-fill the technical input with a # Telas / #
  // APIs / # Branch de Origem / # Tecnologias scaffold (known artifacts +
  // the project's technologies, FR-016) instead of a blank field — only
  // once, and never once the analyst has started editing the field.
  useEffect(() => {
    if (technicalTextTouched || !projectTechnologies) return;
    const techList = projectTechnologies
      .map((t) => (t.techVersion ? `${t.name} ${t.techVersion}` : t.name))
      .join(", ");
    setTechnicalText(buildTechnicalTemplate(demandArtifacts, techList, originBranch));
  }, [projectTechnologies, demandArtifacts, originBranch, technicalTextTouched]);

  const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null);
  const { data: execution } = useExecution(runningExecutionId);
  const isProcessing = execution ? execution.status === "QUEUED" || execution.status === "RUNNING" : false;
  const proposal =
    execution?.status === "COMPLETED" ? (execution.output as SpecificationProposal) : null;

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

  async function sendToAi() {
    const result = await triggerRound.mutateAsync({
      business: { notes: businessText },
      technical: { notes: technicalText },
    });
    setRunningExecutionId(result.id);
  }

  async function saveDraft() {
    if (draft === null) return;
    await createVersion.mutateAsync({ content: draft, reason: "Edited via console" });
    setDraft(null);
  }

  async function acceptProposal(markdown: string) {
    await createVersion.mutateAsync({ content: markdown, reason: "Accepted AI proposal" });
    setRunningExecutionId(null);
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

      <section>
        {hasPermission("AGENT_EXECUTE") && (
          <button type="button" onClick={sendToAi} disabled={isProcessing}>
            Enviar para IA
          </button>
        )}
        {isProcessing && <p>Processando em segundo plano (status: {execution?.status})…</p>}
        {execution?.status === "FAILED" && <p className="form-field-error">{execution.error}</p>}

        {proposal && (
          <div>
            <h2>Proposta da IA</h2>
            <p>{proposal.summary}</p>
            <ProposalList title="Requisitos de negócio" items={proposal.businessRequirements} />
            <ProposalList title="Regras de negócio" items={proposal.businessRules} />
            <ProposalList title="Critérios de aceite" items={proposal.acceptanceCriteria} />
            <ProposalList title="Fluxos" items={proposal.flows} />
            <ProposalList title="Requisitos técnicos" items={proposal.technicalRequirements} />
            <ProposalList title="Artefatos identificados" items={proposal.identifiedArtifacts} />
            <ProposalList title="Riscos" items={proposal.risks} />
            <ProposalList title="Perguntas em aberto" items={proposal.questions} />
            {proposal.changeSummary && (
              <div>
                <h2>Resumo do impacto (incremento)</h2>
                <ProposalList title="Regras adicionadas" items={proposal.changeSummary.rulesAdded} />
                <ProposalList
                  title="Artefatos impactados"
                  items={proposal.changeSummary.artifactsImpacted}
                />
                <ProposalList title="APIs impactadas" items={proposal.changeSummary.apisImpacted} />
                <ProposalList title="Dados impactados" items={proposal.changeSummary.dataImpacted} />
                <ProposalList
                  title="Testes sugeridos"
                  items={proposal.changeSummary.suggestedTests}
                />
              </div>
            )}
            {hasPermission("SPECIFICATION_WRITE") && (
              <button type="button" onClick={() => acceptProposal(proposal.specifyMarkdown)}>
                Aceitar proposta (specify.md)
              </button>
            )}
            {hasPermission("AGENT_EXECUTE") && (
              <button type="button" onClick={sendToAi}>
                Nova rodada
              </button>
            )}
          </div>
        )}
      </section>

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

function ProposalList({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
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
