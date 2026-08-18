import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DEPENDENCY_ANALYSIS_QUEUE } from "../../common/queue/queue.module";
import { DependencyAnalyzerService } from "./dependency-analyzer.service";
import type { DependencyAnalysisJobData } from "./dependency-analysis-runs.service";

/**
 * Worker for the Artefatos-screen-triggered dependency mapping — a
 * dedicated queue/processor (`DEPENDENCY_ANALYSIS_QUEUE`), separate from
 * `EXECUTIONS_QUEUE`/`ExecutionsProcessor` (Developer Agent pipeline),
 * which this feature must not touch or share state with.
 */
@Processor(DEPENDENCY_ANALYSIS_QUEUE)
export class DependencyAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(DependencyAnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyzer: DependencyAnalyzerService,
  ) {
    super();
  }

  async process(job: Job<DependencyAnalysisJobData>): Promise<void> {
    const { runId, systemArtifactId, branch } = job.data;
    await this.prisma.db.dependencyAnalysisRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const onProgress = async (stage: string) => {
      await this.prisma.db.dependencyAnalysisRun.update({ where: { id: runId }, data: { stage } });
    };

    try {
      const summary = await this.analyzer.analyzeArtifact(systemArtifactId, branch, runId, onProgress);
      await this.prisma.db.dependencyAnalysisRun.update({
        where: { id: runId },
        data: { status: "COMPLETED", finishedAt: new Date(), summary: summary as object },
      });
    } catch (error) {
      this.logger.error(`DependencyAnalysisRun ${runId} failed`, error as Error);
      await this.prisma.db.dependencyAnalysisRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
