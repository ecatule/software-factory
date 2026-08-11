import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import {
  LLM_PROVIDER,
  SDD_PROVIDER,
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
import { DeveloperAgentService } from "./developer-agent.service";
import type { ExecutionJobData } from "./executions.service";

const STAGE_TO_DOCUMENT_TYPE: Record<string, SpecDocumentType> = {
  specify: "SPEC",
  clarify: "SPEC",
  plan: "PLAN",
  checklist: "CHECKLIST",
  tasks: "TASKS",
  analyze: "ANALYSIS",
};

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
        // follow-up: the developer pipeline runs several minutes-long steps
        // in sequence inside ONE AgentExecution — without this, the only
        // externally visible state was QUEUED/RUNNING for the whole
        // duration, with no way to tell which step was actually in
        // progress. Reuses the existing (otherwise unused-by-this-branch)
        // `pipelineStage` column as a live progress marker, polled by the
        // frontend the same way `status` already is.
        const updateProgress = (pipelineStage: string) =>
          this.prisma.db.agentExecution.update({ where: { id: execution.id }, data: { pipelineStage } });

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
        await updateProgress("branches");
        await this.developerAgent.ensureBranchesForDemand(execution.demandId);
        await updateProgress("cloning");
        await this.developerAgent.ensureRepositoriesCloned(execution.demandId, workspacePath);
        // security: cloned but not yet touched by the AI — the one moment
        // to refuse before the Developer Agent can read/act on production data.
        await updateProgress("safety-check");
        await this.developerAgent.enforceProductionSafety(execution.demandId, workspacePath);

        // follow-up: snapshotted BEFORE `implement` runs so the post-implement
        // auto-commit (below) can tell "changed by this run" apart from files
        // that were already dirty in the working tree beforehand (e.g. local,
        // unrelated edits) — never staged/committed automatically.
        const artifactRepoPaths = await this.developerAgent.resolveArtifactRepositoryPaths(
          execution.demandId,
          workspacePath,
        );
        const dirtyBefore = await this.developerAgent.snapshotDirtyFiles(
          artifactRepoPaths.map((link) => link.repoPath),
        );

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
        const { specContent, planContent } = await this.developerAgent.resolveCurrentSpecAndPlanContent(
          execution.demandId,
        );
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
        // a manual upload.
        await updateProgress("tasks");
        const tasksResult = await this.sddProvider.tasks({
          demandId: execution.demandId,
          workspacePath,
          context: sddContext,
        });
        await this.writeSpecificationVersion(execution, "tasks", tasksResult.content);

        await updateProgress("analyze");
        const analyzeResult = await this.sddProvider.analyze({
          demandId: execution.demandId,
          workspacePath,
          context: sddContext,
        });
        await this.writeSpecificationVersion(execution, "analyze", analyzeResult.content);

        await updateProgress("checklist");
        const checklistResult = await this.sddProvider.checklist({
          demandId: execution.demandId,
          workspacePath,
          context: sddContext,
        });
        await this.writeSpecificationVersion(execution, "checklist", checklistResult.content);

        await updateProgress("implement");
        const result = await this.sddProvider.implement({
          demandId: execution.demandId,
          workspacePath,
          context: sddContext,
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

        // follow-up: commits+pushes only the files that became dirty DURING
        // this run (per-repo diff against the `dirtyBefore` snapshot) — a
        // real, live-observed case had unrelated pre-existing uncommitted
        // changes (production-URL sanitization from an earlier run) sitting
        // in the same working tree; a naive "commit everything dirty" would
        // have swept those into this feature's commit.
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

        await this.prisma.db.agentExecution.update({
          where: { id: execution.id },
          data: { status: "COMPLETED", finishedAt: new Date(), output: { ...result, commits: commitResults } },
        });
        await this.workflows.advanceToStage(execution.demandId, "TESTING");
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
            "artifactsImpacted[], apisImpacted[], dataImpacted[], suggestedTests[]}}.",
          prompt: JSON.stringify(context),
        });
        this.validateSpecificationProposal(proposal);

        await this.writeSpecificationVersionsFromProposal(execution, increment.id, proposal);

        await this.prisma.db.agentExecution.update({
          where: { id: execution.id },
          data: { status: "COMPLETED", finishedAt: new Date(), output: proposal as object },
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
      });

      await this.writeSpecificationVersion(execution, stage, result.content);

      await this.prisma.db.agentExecution.update({
        where: { id: execution.id },
        data: { status: "COMPLETED", finishedAt: new Date(), output: result },
      });

      await this.workflows.advanceToNextStage(execution.demandId);
    } catch (error) {
      this.logger.error(`Execution ${execution.id} failed`, error as Error);
      await this.prisma.db.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      if (execution.agent.type === "developer") {
        await this.workflows.advanceToStage(execution.demandId, "FAILED");
      }
      throw error;
    }
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
