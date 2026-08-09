import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DEMAND_PROVIDER, type DemandProvider } from "@software-factory/domain";
import type { DemandType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { CreateDemandDto, UpdateDemandDto } from "./dto/demand.dto";

export interface DemandListFilter {
  clientId?: string;
  projectId?: string;
  status?: string;
  type?: DemandType;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DEMAND_PROVIDER) private readonly demandProvider: DemandProvider,
  ) {}

  /** spec 002 SC-007: page_size is capped by the shared paginate() helper. */
  list(filter: DemandListFilter) {
    const where = {
      clientId: filter.clientId,
      projectId: filter.projectId,
      status: filter.status,
      type: filter.type,
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.demand.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.demand.count({ where }),
      filter.page,
      filter.pageSize,
    );
  }

  async get(id: string) {
    const demand = await this.prisma.db.demand.findUnique({ where: { id } });
    if (!demand) throw new NotFoundException(`Demand ${id} not found`);
    return demand;
  }

  /**
   * spec FR-028 / Clarifications 2026-08-07: (origin, external_id) is unique.
   * A second import attempt for the same pair MUST be rejected (409), never
   * silently update the existing demand or create a duplicate.
   */
  async create(dto: CreateDemandDto, actingUserId?: string) {
    const existing = await this.prisma.db.demand.findUnique({
      where: { origin_externalId: { origin: dto.origin, externalId: dto.externalId } },
    });
    if (existing) {
      throw new ConflictException(
        `Demand with origin=${dto.origin} external_id=${dto.externalId} already exists ` +
          `(id=${existing.id}) — the platform does not auto re-sync after import (FR-028).`,
      );
    }
    return this.prisma.db.demand.create({
      data: { ...dto, status: "NEW", createdBy: actingUserId, updatedBy: actingUserId },
    });
  }

  /**
   * Imports a demand by resolving its data from the configured DemandProvider
   * (spec FR-003) instead of a caller-supplied payload — the concrete step
   * that keeps this module from ever calling Monday's API directly.
   */
  async importFromProvider(externalId: string, clientId: string, projectId: string) {
    const record = await this.demandProvider.getDemand(externalId);
    return this.create({
      externalId: record.externalId,
      origin: record.origin,
      title: record.title,
      description: record.description,
      type: record.type as unknown as CreateDemandDto["type"],
      priority: record.priority,
      clientId,
      projectId,
    });
  }

  async update(id: string, dto: UpdateDemandDto) {
    await this.get(id);
    return this.prisma.db.demand.update({ where: { id }, data: dto });
  }

  async timeline(id: string) {
    await this.get(id);
    return this.prisma.db.auditLog.findMany({
      where: { entityType: "demands", entityId: id },
      orderBy: { occurredAt: "asc" },
    });
  }
}
