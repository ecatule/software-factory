import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SDD_PROVIDER, type SDDProvider } from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { EXECUTIONS_QUEUE } from "../../common/queue/queue.module";
import { DeveloperAgentService } from "./developer-agent.service";
import { CreateExecutionDto } from "./dto/execution.dto";

export interface ExecutionJobData {
  executionId: string;
}

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly developerAgent: DeveloperAgentService,
    @InjectQueue(EXECUTIONS_QUEUE) private readonly queue: Queue<ExecutionJobData>,
    @Inject(SDD_PROVIDER) private readonly sddProvider: SDDProvider,
  ) {}

  /** spec 002 FR-021/FR-022: paginated, on top of 001's demand/agent/status filters. */
  async list(demandId: string | undefined, agentId: string | undefined, status: string | undefined, page: number, pageSize: number) {
    const where = { demandId, agentId, status: status as never };
    const result = await paginate(
      (skip, take) =>
        this.prisma.db.agentExecution.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: { agent: true },
        }),
      () => this.prisma.db.agentExecution.count({ where }),
      page,
      pageSize,
    );
    return { ...result, items: await this.withDemandTitles(result.items) };
  }

  async get(id: string) {
    const execution = await this.prisma.db.agentExecution.findUnique({
      where: { id },
      include: { agent: true },
    });
    if (!execution) throw new NotFoundException(`AgentExecution ${id} not found`);
    const [withTitle] = await this.withDemandTitles([execution]);
    return withTitle;
  }

  /**
   * follow-up: `AgentExecution` has no Prisma relation to `Demand` (only the
   * scalar `demandId` FK, same convention as `ArtifactRepository` elsewhere
   * in this schema) — resolved with one bulk lookup instead of a relation
   * `include`, so the Executions screen can show the demand's title instead
   * of its raw id.
   */
  private async withDemandTitles<T extends { demandId: string }>(
    executions: T[],
  ): Promise<(T & { demandTitle: string | null })[]> {
    const demandIds = [...new Set(executions.map((e) => e.demandId))];
    const demands = await this.prisma.db.demand.findMany({
      where: { id: { in: demandIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(demands.map((d) => [d.id, d.title]));
    return executions.map((e) => ({ ...e, demandTitle: titleById.get(e.demandId) ?? null }));
  }

  /** spec User Stories 2 & 6: enqueues a BullMQ job; returns immediately QUEUED. */
  async create(dto: CreateExecutionDto) {
    const execution = await this.prisma.db.agentExecution.create({
      data: {
        agentId: dto.agentId,
        demandId: dto.demandId,
        providerConfigurationId: dto.providerConfigurationId,
        pipelineStage: dto.pipelineStage,
        // feature 003 (research.md §11): previously always defaulted to "{}".
        input: dto.input ?? {},
        status: "QUEUED",
      },
    });
    await this.queue.add("run-execution", { executionId: execution.id });
    return execution;
  }

  /**
   * follow-up: "Retry" used to always redo the whole "developer" pipeline
   * from scratch, including tasks/analyze/checklist even when those had
   * already succeeded and only `implement` failed — ~4-5min of real Claude
   * calls wasted every retry. Now detects when that's safe to skip: the
   * original execution got at least as far as `implement` (i.e.
   * tasks/analyze/checklist already succeeded — `pipelineStage` only
   * reaches "implement"/"commit" after each of those completed) AND the
   * demand's SPEC/PLAN haven't changed since (compared by
   * SpecificationVersion id, recorded on the original execution — see
   * `ExecutionsProcessor`). If either doesn't hold, retries the full
   * pipeline exactly as before — this is purely an optimization, never a
   * behavior change for the unsafe case.
   *
   * feature 006 (pipeline configurável): `resumeFromStage` foi unificado em
   * `resumeStage` — o mesmo campo que `advance()` usa pra retomar de uma
   * etapa manual (`ExecutionsProcessor` `DEVELOPER_STAGE_ORDER`), evitando
   * dois mecanismos paralelos de "pular etapas já feitas".
   */
  async retry(id: string) {
    const original = await this.get(id);
    const input: Record<string, unknown> = {};

    const reachedImplement =
      original.pipelineStage === "implement" || original.pipelineStage === "commit";
    if (
      original.agent.type === "developer" &&
      reachedImplement &&
      original.specVersionId &&
      original.planVersionId
    ) {
      const current = await this.developerAgent.resolveCurrentSpecAndPlanContent(original.demandId);
      if (
        current.specVersionId === original.specVersionId &&
        current.planVersionId === original.planVersionId
      ) {
        input.resumeStage = "implement";
      }
    }

    return this.create({
      agentId: original.agentId,
      demandId: original.demandId,
      providerConfigurationId: original.providerConfigurationId ?? undefined,
      pipelineStage: original.pipelineStage ?? undefined,
      input,
    });
  }

  /**
   * feature 006 (pipeline configurável): "Avançar etapa" — cria uma NOVA
   * AgentExecution (mesmo padrão de `retry()`, nunca muta a linha parada)
   * que retoma exatamente da etapa manual pendente, usando o `resumeState`
   * persistido por `ExecutionsProcessor.gate()`. Roda só aquela etapa (e
   * qualquer etapa AUTO logo depois) — pausa de novo se a etapa seguinte
   * também for MANUAL.
   */
  async advance(id: string) {
    const original = await this.get(id);
    if (original.status !== "AWAITING_MANUAL_STAGE" || !original.pipelineStage) {
      throw new BadRequestException("Execution is not awaiting a manual pipeline stage");
    }

    return this.create({
      agentId: original.agentId,
      demandId: original.demandId,
      providerConfigurationId: original.providerConfigurationId ?? undefined,
      pipelineStage: original.pipelineStage,
      input: {
        resumeStage: original.pipelineStage,
        resumeState: original.resumeState ?? {},
      },
    });
  }

  /** feature 006 (pipeline configurável): histórico real de início/fim por etapa desta execução — ver ExecutionStageLog. */
  stages(id: string) {
    return this.prisma.db.executionStageLog.findMany({
      where: { executionId: id },
      orderBy: { startedAt: "asc" },
    });
  }

  /**
   * follow-up: previously only flipped the DB status — the actual
   * subprocess (headless `claude`, see `SpecKitProvider`) kept running
   * unattended, and its eventual completion/failure could silently
   * overwrite this CANCELLED status later
   * (`ExecutionsProcessor.setTerminalStatus` now guards against that too).
   * `sddProvider.cancel` is optional (Provider Abstraction) and only does
   * anything when a process is actually still tracked as running for this
   * execution id.
   */
  async cancel(id: string) {
    const execution = await this.get(id);
    if (execution.status === "RUNNING") {
      this.sddProvider.cancel?.(id);
    }
    return this.prisma.db.agentExecution.update({
      where: { id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
  }
}
