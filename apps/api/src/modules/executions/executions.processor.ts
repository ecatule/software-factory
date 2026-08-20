import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import {
  LLM_PROVIDER,
  SDD_PROVIDER,
  type ImplementationResult,
  type LLMProvider,
  type SDDProvider,
  type SpecificationProposal,
} from "@software-factory/domain";
import type { SpecDocumentType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EXECUTIONS_QUEUE } from "../../common/queue/queue.module";
import { WorkflowsService } from "../workflows/workflows.service";
import { SpecificationContextService } from "../specifications/specification-context.service";
import { IncrementsService } from "../increments/increments.service";
import { ProviderConfigurationResolver } from "../providers/provider-configuration.resolver";
import { GitService } from "../git/git.service";
import { QaGenerationService, type GenerateTestCasesResult } from "../qa/qa-generation.service";
import { PipelineConfigService } from "../pipeline-config/pipeline-config.service";
import { DEVELOPER_STAGE_ORDER } from "../pipeline-config/pipeline-stage-order";
import { DeveloperAgentService } from "./developer-agent.service";
import type { ExecutionJobData } from "./executions.service";
import { extractUnassistedNote } from "./implementation-note";

const STAGE_TO_DOCUMENT_TYPE: Record<string, SpecDocumentType> = {
  specify: "SPEC",
  clarify: "SPEC",
  plan: "PLAN",
  checklist: "CHECKLIST",
  tasks: "TASKS",
  analyze: "ANALYSIS",
};

/**
 * feature 006 (pipeline configurável): lançado por `gate()` quando a
 * PRÓXIMA etapa está configurada como `MANUAL` — NÃO é uma falha genuína
 * (ver o `catch` de `process()`, que trata isso separado do resto). A
 * execução já foi marcada `AWAITING_MANUAL_STAGE` antes de lançar.
 */
class PipelinePausedSignal extends Error {
  constructor(readonly stage: string) {
    super(`Pipeline paused before manual stage "${stage}"`);
  }
}

interface DeveloperResumeState {
  dirtyBefore?: Record<string, string[]>;
  implementResult?: ImplementationResult;
  qaResult?: GenerateTestCasesResult;
  postImplementNote?: {
    hasUnassistedNote?: boolean;
    unassistedNoteExcerpt?: string | null;
    specVersionId?: string;
    tasksVersionId?: string;
  };
}

function serializeDirtyBefore(map: Map<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries([...map.entries()].map(([repoPath, files]) => [repoPath, [...files]]));
}

function deserializeDirtyBefore(serialized: Record<string, string[]> | undefined): Map<string, Set<string>> {
  return new Map(Object.entries(serialized ?? {}).map(([repoPath, files]) => [repoPath, new Set(files)]));
}

/**
 * spec User Story 2 (Specification pipeline) / User Story 6 (Developer
 * Agent, once agent.type === "developer"): the BullMQ worker that actually
 * runs an AgentExecution — the only place SDDProvider/LLMProvider are
 * invoked from, keeping the AI Agent Boundary principle enforced by module
 * boundaries (this processor lives in apps/api, never in apps/web).
 */
@Processor(EXECUTIONS_QUEUE)
export class ExecutionsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowsService,
    private readonly developerAgent: DeveloperAgentService,
    private readonly gitService: GitService,
    private readonly qaGenerationService: QaGenerationService,
    private readonly pipelineConfigService: PipelineConfigService,
    private readonly specificationContext: SpecificationContextService,
    private readonly increments: IncrementsService,
    private readonly providerConfiguration: ProviderConfigurationResolver,
    @Inject(SDD_PROVIDER) private readonly sddProvider: SDDProvider,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LLMProvider,
  ) {
    super();
  }

  async process(job: Job<ExecutionJobData>): Promise<void> {
    const execution = await this.prisma.db.agentExecution.update({
      where: { id: job.data.executionId },
      data: { status: "RUNNING", startedAt: new Date() },
      include: { agent: true },
    });

    try {
      const workspacePath = await this.developerAgent.resolveWorkspacePath(execution.demandId);
      const stage = execution.pipelineStage ?? "specify";
      const demand = await this.prisma.db.demand.findUniqueOrThrow({
        where: { id: execution.demandId },
        include: { project: true },
      });
      // follow-up: written into `.specify/memory/constitution.md` before
      // every SDD stage runs (SpecKitProvider.ensureInitialized), so
      // `/speckit-specify`/`/speckit-plan`/etc. read this Project's real
      // governance rules instead of the blank Spec Kit template.
      const constitution = demand.project.constitution ?? undefined;

      if (execution.agent.type === "developer") {
        // feature 006 (pipeline configurável): fecha o log RUNNING da etapa
        // anterior (se houver) e abre um novo — histórico real de
        // início/fim por etapa, distinto de `pipelineStage` (que só guarda
        // a etapa ATUAL, sobrescrita a cada chamada).
        let openStageLogId: string | undefined;
        const closeCurrentStageLog = async (status: "COMPLETED" | "FAILED") => {
          if (!openStageLogId) return;
          await this.prisma.db.executionStageLog.update({
            where: { id: openStageLogId },
            data: { status, finishedAt: new Date() },
          });
          openStageLogId = undefined;
        };

        // follow-up: the developer pipeline runs several minutes-long steps
        // in sequence inside ONE AgentExecution — without this, the only
        // externally visible state was QUEUED/RUNNING for the whole
        // duration, with no way to tell which step was actually in
        // progress. Reuses the existing (otherwise unused-by-this-branch)
        // `pipelineStage` column as a live progress marker, polled by the
        // frontend the same way `status` already is.
        const updateProgress = async (pipelineStage: string) => {
          await closeCurrentStageLog("COMPLETED");
          await this.prisma.db.agentExecution.update({ where: { id: execution.id }, data: { pipelineStage } });
          const log = await this.prisma.db.executionStageLog.create({
            data: { executionId: execution.id, stage: pipelineStage, status: "RUNNING", startedAt: new Date() },
          });
          openStageLogId = log.id;
        };

        // feature 006 (pipeline configurável): `resumeStage` é gravado por
        // `ExecutionsService.advance()` (etapa manual retomada) OU por
        // `ExecutionsService.retry()` (mecanismo pré-existente de retomar
        // direto no `implement`, agora unificado neste mesmo campo) — todas
        // as etapas com índice MENOR que `resumeStage` em
        // `DEVELOPER_STAGE_ORDER` já rodaram numa execução anterior desta
        // mesma cadeia e são puladas aqui, sem repetir chamadas reais de IA
        // nem duplicar `SpecificationVersion`/`TestCase`. `resumeState`
        // carrega o que essas etapas puladas já produziram.
        const stageOrder: readonly string[] = DEVELOPER_STAGE_ORDER;
        const executionInput = (execution.input as Record<string, unknown> | null) ?? {};
        const resumeStage = executionInput.resumeStage as string | undefined;
        const carriedState = (executionInput.resumeState as DeveloperResumeState | undefined) ?? {};
        const resumeIndex = resumeStage ? stageOrder.indexOf(resumeStage) : -1;
        const shouldSkip = (stage: (typeof DEVELOPER_STAGE_ORDER)[number]) =>
          resumeIndex >= 0 && stageOrder.indexOf(stage) < resumeIndex;

        /**
         * spec do pedido do usuário ("Eu ter a possibilidade de alterar se
         * automática ou manual"): verifica `PipelineStageConfig` ANTES de
         * cada uma das 9 etapas — se `MANUAL` (e esta execução não foi
         * criada especificamente pra rodar esta etapa, via `resumeStage`),
         * persiste `AWAITING_MANUAL_STAGE` + `resumeState` e lança
         * `PipelinePausedSignal`, capturado no `catch` de `process()` sem
         * marcar a execução como FAILED.
         *
         * bug encontrado ao vivo (live-validation finding): faltava o
         * `shouldSkip(stage)` aqui — uma execução retomada em, digamos,
         * "qa-generation" (`resumeStage`) só pulava o `gate` daquela ETAPA
         * exata; se `implement` (uma etapa ANTERIOR, já concluída numa
         * execução anterior desta cadeia) também estivesse configurada
         * `MANUAL`, o gate pausava de novo ali — "Avançar etapa" parecia
         * "voltar pra implementação" em vez de seguir pra QA. Qualquer
         * etapa anterior ao ponto de retomada já foi efetivamente aprovada
         * numa execução anterior da cadeia — nunca pausa de novo por ela.
         */
        const gate = async (
          stage: (typeof DEVELOPER_STAGE_ORDER)[number],
          buildResumeState: () => DeveloperResumeState,
        ) => {
          if (stage === resumeStage || shouldSkip(stage)) return;
          const mode = await this.pipelineConfigService.getMode(stage);
          if (mode !== "MANUAL") return;
          await closeCurrentStageLog("COMPLETED");
          await this.prisma.db.agentExecution.update({
            where: { id: execution.id },
            data: {
              status: "AWAITING_MANUAL_STAGE",
              pipelineStage: stage,
              resumeState: { ...carriedState, ...buildResumeState() } as object,
            },
          });
          throw new PipelinePausedSignal(stage);
        };

        // follow-up: SPEC/PLAN reaching this point never went through the
        // generic per-stage execution branch below (its own
        // `advanceToNextStage` call never ran) — they either came from
        // "Anexar arquivos prontos" (a plain upload, no AgentExecution at
        // all) or the specification_copilot branch (which also never
        // advances the workflow). Demand.status was staying stuck at "NEW"
        // regardless of real progress. `advanceToStage` catches it up in one
        // jump instead of requiring a hop per skipped stage.
        await this.workflows.advanceToStage(execution.demandId, "DEVELOPMENT");

        // spec User Story 6: reuse ONE branch per repository for this demand
        // (spec Edge Cases), then clone it locally so "Modo B" (headless
        // Claude Code) has real files to edit, then implement, then record
        // file changes (DISCOVERED files get a justification — spec FR-017).
        // branches/cloning/safety-check são baratas e idempotentes — mesmo
        // retomando de uma etapa posterior, rodam de novo sempre (nunca
        // puladas por `shouldSkip`); só o `gate()` (pausa manual) se aplica.
        await gate("branches", () => ({}));
        await updateProgress("branches");
        await this.developerAgent.ensureBranchesForDemand(execution.demandId);

        await gate("cloning", () => ({}));
        await updateProgress("cloning");
        await this.developerAgent.ensureRepositoriesCloned(execution.demandId, workspacePath);

        // security: cloned but not yet touched by the AI — the one moment
        // to refuse before the Developer Agent can read/act on production data.
        await gate("safety-check", () => ({}));
        await updateProgress("safety-check");
        await this.developerAgent.enforceProductionSafety(execution.demandId, workspacePath);

        const artifactRepoPaths = await this.developerAgent.resolveArtifactRepositoryPaths(
          execution.demandId,
          workspacePath,
        );
        // follow-up: snapshotted BEFORE `implement` (na verdade, antes de
        // tasks/analyze/checklist também — eles podem gravar arquivos no
        // workspace) so the post-implement auto-commit (below) can tell
        // "changed by this run" apart from files that were already dirty in
        // the working tree beforehand. feature 006: se esta execução está
        // retomando de uma etapa posterior, o snapshot original já foi
        // capturado numa execução anterior desta cadeia — reaproveita do
        // `resumeState` em vez de recalcular (recalcular aqui perderia o
        // registro de arquivos já alterados por etapas anteriores puladas).
        const dirtyBefore = carriedState.dirtyBefore
          ? deserializeDirtyBefore(carriedState.dirtyBefore)
          : await this.developerAgent.snapshotDirtyFiles(artifactRepoPaths.map((link) => link.repoPath));

        const context = await this.providerConfiguration.resolveSddContext(
          demand.projectId,
          "implement",
        );
        // follow-up: "Anexar arquivos prontos"/"Aprovar e executar" only
        // ever write to Postgres (SpecificationVersion) — never to the
        // workspace's `specs/<NNN>/spec.md`/`plan.md` files a real
        // `/speckit-specify`/`/speckit-plan` run would have produced.
        // Passed through so SpecKitProvider can sync them onto disk right
        // after `specify init` runs (never before — that command can wipe
        // `.specify/`), so `/speckit-implement` always sees this Software
        // Factory's current approved content regardless of how it got there.
        const { specContent, planContent, specVersionId, planVersionId } =
          await this.developerAgent.resolveCurrentSpecAndPlanContent(execution.demandId);
        // follow-up: recorded so a later `ExecutionsService.retry()` can
        // tell whether SPEC/PLAN changed since this attempt — only safe to
        // skip straight to `implement` (see resumeFromStage below) when
        // they still match.
        await this.prisma.db.agentExecution.update({
          where: { id: execution.id },
          data: { specVersionId, planVersionId },
        });
        const sddContext = {
          ...context,
          constitution,
          specContent,
          planContent,
          demandTitle: demand.title,
        };
        // follow-up (live-validation finding): `/speckit-implement` refuses
        // to proceed without a `tasks.md` breakdown ("no tasks.md, please
        // run /speckit-tasks first"), and `/speckit-analyze` itself
        // requires `tasks.md` to already exist. Every developer execution
        // must run the full pre-implement SDD chain — not just spec/plan —
        // regardless of whether spec/plan came from a real pipeline run or
        // a manual upload. UNLESS retomando de uma etapa posterior
        // (`shouldSkip`) — então tasks.md/analysis.md/checklists/*.md já
        // existem no workspace de uma execução anterior desta cadeia, e
        // seus `SpecificationVersion` já existem também — pula sem chamar
        // Claude de novo.
        await gate("tasks", () => ({ dirtyBefore: serializeDirtyBefore(dirtyBefore) }));
        if (!shouldSkip("tasks")) {
          await updateProgress("tasks");
          const tasksResult = await this.sddProvider.tasks({
            demandId: execution.demandId,
            workspacePath,
            context: sddContext,
            executionId: execution.id,
          });
          await this.writeSpecificationVersion(execution, "tasks", tasksResult.content);
        }

        await gate("analyze", () => ({ dirtyBefore: serializeDirtyBefore(dirtyBefore) }));
        if (!shouldSkip("analyze")) {
          await updateProgress("analyze");
          const analyzeResult = await this.sddProvider.analyze({
            demandId: execution.demandId,
            workspacePath,
            context: sddContext,
            executionId: execution.id,
          });
          await this.writeSpecificationVersion(execution, "analyze", analyzeResult.content);
        }

        await gate("checklist", () => ({ dirtyBefore: serializeDirtyBefore(dirtyBefore) }));
        if (!shouldSkip("checklist")) {
          await updateProgress("checklist");
          const checklistResult = await this.sddProvider.checklist({
            demandId: execution.demandId,
            workspacePath,
            context: sddContext,
            executionId: execution.id,
          });
          await this.writeSpecificationVersion(execution, "checklist", checklistResult.content);
        }

        await gate("implement", () => ({ dirtyBefore: serializeDirtyBefore(dirtyBefore) }));
        let result: ImplementationResult;
        let postImplementNote: {
          hasUnassistedNote?: boolean;
          unassistedNoteExcerpt?: string | null;
          specVersionId?: string;
          tasksVersionId?: string;
        };
        if (!shouldSkip("implement")) {
          await updateProgress("implement");
          result = await this.sddProvider.implement({
            demandId: execution.demandId,
            workspacePath,
            context: sddContext,
            executionId: execution.id,
          });

          const [firstArtifact] = await this.prisma.db.artifact.findMany({
            where: { demandId: execution.demandId },
            take: 1,
          });
          if (firstArtifact && result.filesChanged.length > 0) {
            // NOTE: SpecKitProvider.implement() reports files changed for the
            // whole demand, not per artifact — attributing them all to the
            // first artifact is a known simplification until the SDD
            // integration reports artifact-scoped results.
            await this.developerAgent.recordImplementationFiles(
              execution.demandId,
              firstArtifact.id,
              result.filesChanged,
            );
          }

          // follow-up: `/speckit-implement` is the only stage that can rewrite
          // spec.md/tasks.md AFTER they were already generated (e.g. to record
          // an assumption it had to make with no analyst available) — never
          // persisted anywhere before this, only ever on the workspace's own
          // disk. Isolated in its own try/catch (see the method itself) so a
          // bug here can never turn a genuinely successful `implement` into a
          // FAILED execution.
          postImplementNote = await this.persistPostImplementSnapshots(execution, result);
        } else {
          // feature 006: `implement` já rodou numa execução anterior desta
          // cadeia — reaproveita o resultado carregado em `resumeState` em
          // vez de rodar `/speckit-implement` de novo (custaria minutos de
          // subprocesso real e poderia reimplementar por cima do que já foi
          // feito).
          result = carriedState.implementResult as ImplementationResult;
          postImplementNote = carriedState.postImplementNote ?? {};
        }

        // spec User Story 1 (FR-001/FR-003): o Agente QA (Agent.type = "qa")
        // roda como um novo estágio dentro desta MESMA AgentExecution
        // "developer", entre `implement` e `commit` — geração obrigatória;
        // uma falha genuína aqui propaga para o catch abaixo e bloqueia o
        // Commit (o loop de commit nunca é alcançado), exatamente como o
        // Test Gate já existente. Ausência de cenário aplicável (generated:
        // 0) NÃO é uma falha — segue normalmente. Extrai os Casos de Teste
        // diretamente do spec.md já aprovado (Acceptance Scenarios/Edge
        // Cases) — sem chamar nenhum LLM (research.md decisão 9).
        await gate("qa-generation", () => ({
          dirtyBefore: serializeDirtyBefore(dirtyBefore),
          implementResult: result,
          postImplementNote,
        }));
        let qaResult: GenerateTestCasesResult;
        if (!shouldSkip("qa-generation")) {
          await updateProgress("qa-generation");
          qaResult = await this.qaGenerationService.generateTestCases({
            demandId: execution.demandId,
            executionId: execution.id,
            specContent,
          });
        } else {
          qaResult = carriedState.qaResult as GenerateTestCasesResult;
        }

        // follow-up: commits+pushes only the files that became dirty DURING
        // this run (per-repo diff against the `dirtyBefore` snapshot) — a
        // real, live-observed case had unrelated pre-existing uncommitted
        // changes (production-URL sanitization from an earlier run) sitting
        // in the same working tree; a naive "commit everything dirty" would
        // have swept those into this feature's commit.
        await gate("commit", () => ({
          dirtyBefore: serializeDirtyBefore(dirtyBefore),
          implementResult: result,
          postImplementNote,
          qaResult,
        }));
        await updateProgress("commit");
        const dirtyAfter = await this.developerAgent.snapshotDirtyFiles(
          artifactRepoPaths.map((link) => link.repoPath),
        );
        const commitMessage = `feat[${demand.externalId}] ${demand.title.trim()}\n\nCommit automatico gerado pelo Developer Agent (execucao ${execution.id}).`;
        // follow-up: a per-artifact commit failure (most likely the Test
        // Gate, spec FR-021 — this project has real, working test suites
        // configured) must NOT mark a genuinely successful `implement` as a
        // FAILED execution. Caught individually and reported in `output`
        // instead of thrown, so "implemented but not committed yet" stays
        // visibly distinct from "implementation itself failed".
        const commitResults: Array<
          { artifactId: string; sha: string } | { artifactId: string; error: string }
        > = [];
        for (const link of artifactRepoPaths) {
          const before = dirtyBefore.get(link.repoPath) ?? new Set<string>();
          const after = dirtyAfter.get(link.repoPath) ?? new Set<string>();
          const newFiles = [...after].filter((filePath) => !before.has(filePath));
          if (newFiles.length === 0) continue;
          try {
            const commit = await this.gitService.commit(
              execution.demandId,
              link.artifactId,
              commitMessage,
              newFiles,
              execution.id,
            );
            commitResults.push({ artifactId: link.artifactId, sha: commit.sha });
          } catch (error) {
            commitResults.push({
              artifactId: link.artifactId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        await closeCurrentStageLog("COMPLETED");
        await this.setTerminalStatus(execution.id, {
          status: "COMPLETED",
          finishedAt: new Date(),
          output: { ...result, commits: commitResults, qa: qaResult, ...postImplementNote },
        });
        await this.workflows.advanceToStage(execution.demandId, "TESTING");
        return;
      }

      if (execution.agent.type === "qa") {
        // feature 006: disparo manual, pela tela Agentes, para gerar Casos
        // de Teste em demandas que já foram implementadas ANTES desta
        // feature existir (spec Assumptions) — reaproveita a MESMA
        // QaGenerationService do branch "developer" acima, sem repetir o
        // /speckit-implement inteiro. Não avança Demand.status/workflow,
        // mesma decisão já tomada pra geração automática. Extrai direto do
        // spec.md já aprovado (Acceptance Scenarios/Edge Cases) — sem LLM.
        const { specContent } = await this.developerAgent.resolveCurrentSpecAndPlanContent(execution.demandId);

        const result = await this.qaGenerationService.generateTestCases({
          demandId: execution.demandId,
          executionId: execution.id,
          specContent,
        });

        await this.setTerminalStatus(execution.id, {
          status: "COMPLETED",
          finishedAt: new Date(),
          output: result,
        });
        return;
      }

      if (execution.agent.type === "specification_copilot") {
        // feature 003 (research.md §1/§2/§5): the AI-assisted specification
        // round — the first real caller of LLM_PROVIDER in this codebase.
        const increment = await this.increments.ensureCurrentIncrement(execution.demandId);
        const context = await this.specificationContext.build(
          execution.demandId,
          (execution.input as Record<string, unknown>) ?? {},
        );

        const proposal = await this.llmProvider.generateStructured<SpecificationProposal>({
          systemPrompt:
            "You are a specification copilot for a software factory. Given the JSON " +
            "context, return ONLY a JSON object matching this shape: {summary, " +
            "businessRequirements[], businessRules[], acceptanceCriteria[], flows[], " +
            "technicalRequirements[], identifiedArtifacts[], suggestedArtifacts[], risks[], " +
            "questions[], specifyMarkdown, planMarkdown, changeSummary: {rulesAdded[], " +
            "artifactsImpacted[], apisImpacted[], dataImpacted[], suggestedTests[]}}.\n\n" +
            "If `previousApprovedSpecify`/`previousApprovedPlan` are present in the context, " +
            "this is an INCREMENT, not a fresh specification: treat them as the current " +
            "approved baseline and produce `specifyMarkdown`/`planMarkdown` as a REVISION of " +
            "that baseline that incorporates the change described in `currentIncrement.reason` " +
            "and `humanInput`. Keep every section, requirement, and rule that the new " +
            "reason/input does not affect exactly as it was — do not paraphrase or rewrite " +
            "unaffected content. Only add, remove, or change what the new reason/input actually " +
            "calls for, and list every concrete change in `changeSummary`. A revision that " +
            "comes back nearly identical to the baseline, or one that rewrites unrelated " +
            "sections, are both wrong. If `previousApprovedSpecify`/`previousApprovedPlan` are " +
            "absent, there is no baseline yet — generate the specification from scratch using " +
            "`humanInput` and the demand/project context.",
          prompt: JSON.stringify(context),
        });
        this.validateSpecificationProposal(proposal);

        await this.writeSpecificationVersionsFromProposal(execution, increment.id, proposal);

        await this.setTerminalStatus(execution.id, {
          status: "COMPLETED",
          finishedAt: new Date(),
          output: proposal as object,
        });
        return;
      }

      const stageMethod = this.sddProvider[stage as keyof SDDProvider] as
        | typeof this.sddProvider.specify
        | undefined;
      if (typeof stageMethod !== "function") {
        throw new Error(`Unknown SDD pipeline stage "${stage}"`);
      }

      const context = await this.providerConfiguration.resolveSddContext(demand.projectId, stage);
      const executionInput = (execution.input as Record<string, unknown>) ?? {};
      const description =
        (executionInput.description as string | undefined) ??
        `${demand.title}\n\n${demand.description}`;
      const result = await stageMethod.call(this.sddProvider, {
        demandId: execution.demandId,
        workspacePath,
        context: { ...context, description, constitution },
        executionId: execution.id,
      });

      await this.writeSpecificationVersion(execution, stage, result.content);

      await this.setTerminalStatus(execution.id, {
        status: "COMPLETED",
        finishedAt: new Date(),
        output: result,
      });

      await this.workflows.advanceToNextStage(execution.demandId);
    } catch (error) {
      // feature 006 (pipeline configurável): pausa por etapa manual — NÃO é
      // uma falha. `gate()` já persistiu AWAITING_MANUAL_STAGE + resumeState
      // antes de lançar; aqui só encerra o job sem marcar FAILED nem
      // propagar (BullMQ não deve tentar de novo — é esperado ficar parado
      // até "Avançar etapa").
      if (error instanceof PipelinePausedSignal) {
        this.logger.log(`Execution ${execution.id} paused before manual stage "${error.stage}"`);
        return;
      }
      this.logger.error(`Execution ${execution.id} failed`, error as Error);
      await this.prisma.db.executionStageLog.updateMany({
        where: { executionId: execution.id, status: "RUNNING" },
        data: { status: "FAILED", finishedAt: new Date() },
      });
      await this.setTerminalStatus(execution.id, {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
      if (execution.agent.type === "developer") {
        await this.workflows.advanceToStage(execution.demandId, "FAILED");
      }
      throw error;
    }
  }

  /**
   * follow-up: a "Cancelar" click marks the AgentExecution row CANCELLED
   * directly (`ExecutionsService.cancel`), but the worker processing it may
   * still be mid-flight and unaware — when it eventually finishes or
   * errors, its own terminal-status write must NOT clobber a CANCELLED row.
   * Live-observed: without this guard, a cancelled execution's own
   * in-flight subprocess finishing (or erroring) minutes later silently
   * turned CANCELLED back into COMPLETED/FAILED. `updateMany` with a status
   * filter (instead of `update`) makes this a no-op once cancelled.
   */
  private async setTerminalStatus(
    executionId: string,
    data: { status: "COMPLETED" | "FAILED"; finishedAt: Date; output?: object; error?: string },
  ): Promise<void> {
    await this.prisma.db.agentExecution.updateMany({
      where: { id: executionId, status: { notIn: ["CANCELLED"] } },
      data,
    });
  }

  /** feature 003 (research.md §4): reject a malformed LLM response before persisting anything. */
  private validateSpecificationProposal(proposal: SpecificationProposal): void {
    if (
      typeof proposal?.summary !== "string" ||
      typeof proposal?.specifyMarkdown !== "string" ||
      !proposal.specifyMarkdown.trim() ||
      typeof proposal?.planMarkdown !== "string" ||
      !proposal.planMarkdown.trim() ||
      !Array.isArray(proposal?.businessRequirements)
    ) {
      throw new Error("LLM returned a malformed SpecificationProposal — refusing to persist it.");
    }
  }

  /** feature 003 (research.md §5): one SpecificationVersion per document type (SPEC/PLAN). */
  private async writeSpecificationVersionsFromProposal(
    execution: {
      id: string;
      demandId: string;
      agentId: string;
      providerConfigurationId: string | null;
    },
    incrementId: string,
    proposal: SpecificationProposal,
  ) {
    const hasChangeSummary =
      proposal.changeSummary &&
      Object.values(proposal.changeSummary).some((list) => Array.isArray(list) && list.length > 0);

    for (const [documentType, content] of [
      ["SPEC", proposal.specifyMarkdown],
      ["PLAN", proposal.planMarkdown],
    ] as const) {
      const specification = await this.prisma.db.specification.upsert({
        where: { demandId_documentType: { demandId: execution.demandId, documentType } },
        update: {},
        create: { demandId: execution.demandId, documentType },
      });

      const lastVersion = await this.prisma.db.specificationVersion.findFirst({
        where: { specificationId: specification.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

      const newVersion = await this.prisma.db.specificationVersion.create({
        data: {
          specificationId: specification.id,
          versionNumber: nextVersionNumber,
          content,
          agentId: execution.agentId,
          llmProviderConfigurationId: execution.providerConfigurationId,
          executionId: execution.id,
          incrementId,
          status: "GENERATED",
          source: "AI",
          changeSummary: hasChangeSummary ? (proposal.changeSummary as object) : undefined,
          reason: "Generated by the AI specification copilot",
        },
      });

      await this.prisma.db.specification.update({
        where: { id: specification.id },
        data: { currentVersionId: newVersion.id },
      });
    }
  }


  /**
   * follow-up: wraps its own failures — called from the "developer" branch
   * right after `implement` succeeds, and a bug here must never turn that
   * success into a FAILED execution (same reasoning already applied to
   * per-artifact commit failures just below this call site).
   */
  private async persistPostImplementSnapshots(
    execution: { id: string; demandId: string; agentId: string; providerConfigurationId: string | null },
    result: { specContent?: string; tasksContent?: string },
  ): Promise<{
    hasUnassistedNote?: boolean;
    unassistedNoteExcerpt?: string | null;
    specVersionId?: string;
    tasksVersionId?: string;
  }> {
    try {
      const output: {
        hasUnassistedNote?: boolean;
        unassistedNoteExcerpt?: string | null;
        specVersionId?: string;
        tasksVersionId?: string;
      } = {};

      const noteExcerpt = extractUnassistedNote(result.specContent);
      if (noteExcerpt) {
        output.hasUnassistedNote = true;
        output.unassistedNoteExcerpt = noteExcerpt;
      }

      if (result.specContent?.trim()) {
        const versionId = await this.persistDocumentSnapshotIfChanged(
          execution,
          "SPEC",
          result.specContent,
          noteExcerpt ? { hasUnassistedNote: true, noteExcerpt } : undefined,
        );
        if (versionId) output.specVersionId = versionId;
      }

      if (result.tasksContent?.trim()) {
        const versionId = await this.persistDocumentSnapshotIfChanged(execution, "TASKS", result.tasksContent);
        if (versionId) output.tasksVersionId = versionId;
      }

      return output;
    } catch (error) {
      this.logger.error(
        `Failed to persist post-implement spec/tasks snapshot for execution ${execution.id}`,
        error as Error,
      );
      return {};
    }
  }

  /**
   * follow-up: unlike `writeSpecificationVersion` (always writes — it's the
   * stage's own primary output), this is a side effect of `implement`
   * possibly touching a document that already has a version from an earlier
   * stage — skips the write entirely when the content didn't actually
   * change, so a run that left spec.md/tasks.md untouched doesn't clutter
   * the version history.
   */
  private async persistDocumentSnapshotIfChanged(
    execution: { id: string; demandId: string; agentId: string; providerConfigurationId: string | null },
    documentType: SpecDocumentType,
    content: string,
    changeSummary?: object,
  ): Promise<string | undefined> {
    const specification = await this.prisma.db.specification.upsert({
      where: { demandId_documentType: { demandId: execution.demandId, documentType } },
      update: {},
      create: { demandId: execution.demandId, documentType },
    });

    const lastVersion = await this.prisma.db.specificationVersion.findFirst({
      where: { specificationId: specification.id },
      orderBy: { versionNumber: "desc" },
    });
    if (lastVersion?.content === content) return undefined;

    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;
    const newVersion = await this.prisma.db.specificationVersion.create({
      data: {
        specificationId: specification.id,
        versionNumber: nextVersionNumber,
        content,
        agentId: execution.agentId,
        llmProviderConfigurationId: execution.providerConfigurationId,
        executionId: execution.id,
        reason: "Atualizado pelo Developer Agent durante /speckit-implement (execução não assistida)",
        source: "AI",
        changeSummary: changeSummary as object | undefined,
      },
    });

    await this.prisma.db.specification.update({
      where: { id: specification.id },
      data: { currentVersionId: newVersion.id },
    });

    return newVersion.id;
  }

  private async writeSpecificationVersion(
    execution: { id: string; demandId: string; agentId: string; providerConfigurationId: string | null },
    stage: string,
    content: string,
  ) {
    const documentType = STAGE_TO_DOCUMENT_TYPE[stage] ?? "SPEC";

    const specification = await this.prisma.db.specification.upsert({
      where: { demandId_documentType: { demandId: execution.demandId, documentType } },
      update: {},
      create: { demandId: execution.demandId, documentType },
    });

    const lastVersion = await this.prisma.db.specificationVersion.findFirst({
      where: { specificationId: specification.id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const newVersion = await this.prisma.db.specificationVersion.create({
      data: {
        specificationId: specification.id,
        versionNumber: nextVersionNumber,
        content,
        agentId: execution.agentId,
        llmProviderConfigurationId: execution.providerConfigurationId,
        executionId: execution.id,
        reason: `Generated by pipeline stage "${stage}"`,
      },
    });

    await this.prisma.db.specification.update({
      where: { id: specification.id },
      data: { currentVersionId: newVersion.id },
    });
  }
}
