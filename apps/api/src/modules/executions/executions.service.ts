import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { EXECUTIONS_QUEUE } from "../../common/queue/queue.module";
import { CreateExecutionDto } from "./dto/execution.dto";

export interface ExecutionJobData {
  executionId: string;
}

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXECUTIONS_QUEUE) private readonly queue: Queue<ExecutionJobData>,
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

  async retry(id: string) {
    const original = await this.get(id);
    return this.create({
      agentId: original.agentId,
      demandId: original.demandId,
      providerConfigurationId: original.providerConfigurationId ?? undefined,
      pipelineStage: original.pipelineStage ?? undefined,
    });
  }

  async cancel(id: string) {
    await this.get(id);
    return this.prisma.db.agentExecution.update({
      where: { id },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
  }
}
