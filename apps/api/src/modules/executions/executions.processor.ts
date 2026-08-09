import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import path from "node:path";
import {
  LLM_PROVIDER,
  SDD_PROVIDER,
  type LLMProvider,
  type SDDProvider,
} from "@software-factory/domain";
import type { SpecDocumentType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EXECUTIONS_QUEUE } from "../../common/queue/queue.module";
import { WorkflowsService } from "../workflows/workflows.service";
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
      const workspacePath = await this.resolveWorkspacePath(execution.demandId);
      const stage = execution.pipelineStage ?? "specify";

      if (execution.agent.type === "developer") {
        // spec User Story 6: reuse ONE branch per repository for this demand
        // (spec Edge Cases), then implement, then record file changes
        // (DISCOVERED files get a justification — spec FR-017).
        await this.developerAgent.ensureBranchesForDemand(execution.demandId);
        const result = await this.sddProvider.implement({
          demandId: execution.demandId,
          workspacePath,
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

        await this.prisma.db.agentExecution.update({
          where: { id: execution.id },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result },
        });
        return;
      }

      const stageMethod = this.sddProvider[stage as keyof SDDProvider] as
        | typeof this.sddProvider.specify
        | undefined;
      if (typeof stageMethod !== "function") {
        throw new Error(`Unknown SDD pipeline stage "${stage}"`);
      }

      const result = await stageMethod.call(this.sddProvider, {
        demandId: execution.demandId,
        workspacePath,
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
      throw error;
    }
  }

  private async resolveWorkspacePath(demandId: string): Promise<string> {
    const workspace = await this.prisma.db.demandWorkspace.findUnique({
      where: { demandId },
    });
    return workspace?.path ?? path.join("workspace", demandId);
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
