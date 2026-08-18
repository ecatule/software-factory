import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DependencyAnalysisRunStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DEPENDENCY_ANALYSIS_QUEUE } from "../../common/queue/queue.module";
import { DependencyAnalyzerSettingsService } from "./dependency-analyzer-settings.service";

export interface DependencyAnalysisJobData {
  runId: string;
  systemArtifactId: string;
  branch: string;
}

export interface BulkTriggerResult {
  triggered: string[];
  skipped: Array<{ systemArtifactId: string; reason: string }>;
}

export interface SystemAnalysisStatus {
  total: number;
  completed: number;
  running: number;
  failed: number;
  /** QUEUED runs plus artifacts that have never been analyzed at all yet. */
  pending: number;
}

const ACTIVE_STATUSES: DependencyAnalysisRunStatus[] = ["QUEUED", "RUNNING"];

/**
 * UI-triggered counterpart to the CLI-only `POST .../analyze` this module
 * originally shipped with — enqueues a `DependencyAnalysisRun` the same way
 * `ExecutionsService.create` enqueues an `AgentExecution` (its own separate
 * queue/processor, see `DependencyAnalysisProcessor` — deliberately not
 * reusing `EXECUTIONS_QUEUE`/`ExecutionsProcessor`, which back the
 * Developer Agent pipeline and must stay untouched by this feature).
 */
@Injectable()
export class DependencyAnalysisRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: DependencyAnalyzerSettingsService,
    @InjectQueue(DEPENDENCY_ANALYSIS_QUEUE) private readonly queue: Queue<DependencyAnalysisJobData>,
  ) {}

  async create(systemArtifactId: string) {
    const defaultBranch = await this.requireDefaultBranch();

    const active = await this.prisma.db.dependencyAnalysisRun.findFirst({
      where: { systemArtifactId, status: { in: ACTIVE_STATUSES } },
    });
    if (active) {
      throw new ConflictException("Já existe uma análise em andamento para este artefato.");
    }

    return this.enqueue(systemArtifactId, defaultBranch);
  }

  /**
   * "Mapear todos os artefatos ativos" — every active `SystemArtifact` of
   * this Sistema with an active repository link, skipped individually (not
   * failed as a whole) when one already has a run in flight — mirrors the
   * single-artifact guard in `create()`, just per-item instead of throwing.
   */
  async createForSystem(systemId: string): Promise<BulkTriggerResult> {
    const defaultBranch = await this.requireDefaultBranch();

    const artifacts = await this.prisma.db.systemArtifact.findMany({
      where: { systemId, stAtivo: true, repositories: { some: { stAtivo: true } } },
      select: { id: true },
    });

    const triggered: string[] = [];
    const skipped: BulkTriggerResult["skipped"] = [];
    for (const artifact of artifacts) {
      const active = await this.prisma.db.dependencyAnalysisRun.findFirst({
        where: { systemArtifactId: artifact.id, status: { in: ACTIVE_STATUSES } },
      });
      if (active) {
        skipped.push({ systemArtifactId: artifact.id, reason: "Já existe uma análise em andamento." });
        continue;
      }
      await this.enqueue(artifact.id, defaultBranch);
      triggered.push(artifact.id);
    }
    return { triggered, skipped };
  }

  /**
   * "N Total ativos, N Concluídas, N Em andamento, N Erro, N a Processar" —
   * a manual-refresh status check for "Mapear todos os artefatos ativos"
   * (no auto-polling — same reasoning `useExecution`'s doc-comment gives:
   * continuously hitting the API in the background is unwanted; the
   * frontend calls this on an explicit "Atualizar status" click instead).
   * Counts by each artifact's LATEST run only — an artifact with several
   * past runs is counted once, by its most recent outcome.
   */
  async getSystemStatus(systemId: string): Promise<SystemAnalysisStatus> {
    const artifacts = await this.prisma.db.systemArtifact.findMany({
      where: { systemId, stAtivo: true, repositories: { some: { stAtivo: true } } },
      select: { id: true },
    });
    const artifactIds = artifacts.map((a) => a.id);

    const runs = await this.prisma.db.dependencyAnalysisRun.findMany({
      where: { systemArtifactId: { in: artifactIds } },
      orderBy: { createdAt: "desc" },
      select: { systemArtifactId: true, status: true },
    });
    const latestByArtifact = new Map<string, DependencyAnalysisRunStatus>();
    for (const run of runs) {
      if (!latestByArtifact.has(run.systemArtifactId)) latestByArtifact.set(run.systemArtifactId, run.status);
    }

    let completed = 0;
    let running = 0;
    let failed = 0;
    for (const status of latestByArtifact.values()) {
      if (status === "COMPLETED") completed += 1;
      else if (status === "RUNNING") running += 1;
      else if (status === "FAILED") failed += 1;
    }
    const total = artifactIds.length;
    return { total, completed, running, failed, pending: total - completed - running - failed };
  }

  async getLatestForArtifact(systemArtifactId: string) {
    return this.prisma.db.dependencyAnalysisRun.findFirst({
      where: { systemArtifactId },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(runId: string) {
    const run = await this.prisma.db.dependencyAnalysisRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`DependencyAnalysisRun ${runId} not found`);
    return run;
  }

  private async requireDefaultBranch(): Promise<string> {
    const { defaultBranch } = await this.settings.get();
    if (!defaultBranch) {
      throw new BadRequestException(
        "Configure a branch padrão de mapeamento antes de disparar uma análise.",
      );
    }
    return defaultBranch;
  }

  private async enqueue(systemArtifactId: string, branch: string) {
    const run = await this.prisma.db.dependencyAnalysisRun.create({
      data: { systemArtifactId, branch, status: "QUEUED" },
    });
    await this.queue.add("run-analysis", { runId: run.id, systemArtifactId, branch: run.branch });
    return run;
  }
}
