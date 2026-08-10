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
  list(demandId: string | undefined, agentId: string | undefined, status: string | undefined, page: number, pageSize: number) {
    const where = { demandId, agentId, status: status as never };
    return paginate(
      (skip, take) =>
        this.prisma.db.agentExecution.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.agentExecution.count({ where }),
      page,
      pageSize,
    );
  }

  async get(id: string) {
    const execution = await this.prisma.db.agentExecution.findUnique({ where: { id } });
    if (!execution) throw new NotFoundException(`AgentExecution ${id} not found`);
    return execution;
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
