import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { DEMAND_PROVIDER, type DemandProvider } from "@software-factory/domain";
import type { DemandType, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { CreateDemandDto, UpdateDemandDto } from "./dto/demand.dto";

export interface DemandListFilter {
  clientId?: string;
  projectId?: string;
  status?: string;
  /** feature 004 FR-014/research.md §7. */
  statusIn?: string[];
  type?: DemandType;
  agentId?: string;
  /** "RUNNING" etc — filters by the demand's latest AgentExecution status. */
  agentStatus?: string;
  prStatus?: string;
  hasFailingTests?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DEMAND_PROVIDER) private readonly demandProvider: DemandProvider,
  ) {}

  /**
   * spec 002 SC-007: page_size is capped by the shared paginate() helper.
   * feature 004 FR-013/FR-014: richer filters + response enrichment
   * (client/project names, current increment, current agent, latest PR) —
   * PullRequest/TestExecution/AgentExecution have no Prisma relation array
   * on Demand (scalar `demandId` only), so matching filters resolve via a
   * two-step `id: { in: [...] }` lookup rather than a nested `where`.
   */
  async list(filter: DemandListFilter) {
    const idFilters = await Promise.all([
      this.resolveIdsByAgent(filter.agentId, filter.agentStatus),
      this.resolveIdsByPrStatus(filter.prStatus),
      this.resolveIdsByFailingTests(filter.hasFailingTests),
    ]);
    const intersected = idFilters.filter((ids): ids is string[] => ids !== null);

    const where: Prisma.DemandWhereInput = {
      clientId: filter.clientId,
      projectId: filter.projectId,
      status: filter.statusIn ? { in: filter.statusIn } : filter.status,
      type: filter.type,
      createdAt: {
        gte: filter.createdAfter,
        lte: filter.createdBefore,
      },
      ...(intersected.length > 0
        ? { AND: intersected.map((ids) => ({ id: { in: ids } })) }
        : {}),
    };

    const result = await paginate(
      (skip, take) =>
        this.prisma.db.demand.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: { client: true, project: true, currentIncrement: true },
        }),
      () => this.prisma.db.demand.count({ where }),
      filter.page,
      filter.pageSize,
    );

    const demandIds = result.items.map((d) => d.id);
    const [latestExecutions, latestPullRequests] = await Promise.all([
      this.latestByDemand(
        () =>
          this.prisma.db.agentExecution.findMany({
            where: { demandId: { in: demandIds } },
            orderBy: { createdAt: "desc" },
            include: { agent: true },
          }),
        (e) => e.demandId,
      ),
      this.latestByDemand(
        () =>
          this.prisma.db.pullRequest.findMany({
            where: { demandId: { in: demandIds } },
            orderBy: { createdAt: "desc" },
          }),
        (pr) => pr.demandId,
      ),
    ]);

    return {
      ...result,
      items: result.items.map((d) => ({
        ...d,
        clientName: d.client.name,
        projectName: d.project.name,
        currentIncrement: d.currentIncrement
          ? { number: d.currentIncrement.number, status: d.currentIncrement.status }
          : null,
        currentAgent: latestExecutions.get(d.id)
          ? { name: latestExecutions.get(d.id)!.agent.name }
          : null,
        latestPullRequest: latestPullRequests.get(d.id)
          ? {
              externalReference: latestPullRequests.get(d.id)!.externalReference,
              status: latestPullRequests.get(d.id)!.status,
            }
          : null,
      })),
    };
  }

  /** null = "no filter requested"; string[] = "matching demand ids" (possibly empty). */
  private async resolveIdsByAgent(agentId?: string, agentStatus?: string) {
    if (!agentId && !agentStatus) return null;
    const executions = await this.prisma.db.agentExecution.findMany({
      where: { agentId, status: agentStatus as never },
      select: { demandId: true },
    });
    return [...new Set(executions.map((e) => e.demandId))];
  }

  private async resolveIdsByPrStatus(prStatus?: string) {
    if (!prStatus) return null;
    const prs = await this.prisma.db.pullRequest.findMany({
      where: { status: prStatus },
      select: { demandId: true },
    });
    return [...new Set(prs.map((pr) => pr.demandId))];
  }

  private async resolveIdsByFailingTests(hasFailingTests?: boolean) {
    if (!hasFailingTests) return null;
    const failing = await this.prisma.db.testExecution.findMany({
      where: { status: "FAILED" },
      select: { demandId: true },
    });
    return [...new Set(failing.map((t) => t.demandId))];
  }

  private async latestByDemand<T extends { demandId: string }>(
    fetch: () => Promise<T[]>,
    keyOf: (row: T) => string,
  ): Promise<Map<string, T>> {
    const rows = await fetch();
    const map = new Map<string, T>();
    for (const row of rows) {
      if (!map.has(keyOf(row))) map.set(keyOf(row), row);
    }
    return map;
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

  /**
   * feature 005 User Story 3 (FR-007): `available` is restricted to Systems
   * associated (active `ClientSystem`) with the demand's Client; `selected`
   * is the demand's current `DemandSystem` set — kept even if a selected
   * System is later deactivated or its Client association removed (FR-025),
   * so it's queried independently of `available`, not filtered by it.
   */
  async getAvailableAndSelectedSystems(demandId: string) {
    const demand = await this.get(demandId);
    const [availableLinks, selectedLinks] = await Promise.all([
      this.prisma.db.clientSystem.findMany({
        where: { clientId: demand.clientId, stAtivo: true, system: { stAtivo: true } },
        include: { system: true },
      }),
      this.prisma.db.demandSystem.findMany({
        where: { demandId, stAtivo: true },
        include: { system: true },
      }),
    ]);
    return {
      available: availableLinks.map((l) => l.system),
      selected: selectedLinks.map((l) => l.system),
    };
  }

  /** spec FR-013/SC-006: reject any System not associated (active) with the demand's Client. */
  async setSelectedSystems(demandId: string, systemIds: string[]) {
    const demand = await this.get(demandId);
    if (systemIds.length > 0) {
      const validLinks = await this.prisma.db.clientSystem.findMany({
        where: { clientId: demand.clientId, systemId: { in: systemIds }, stAtivo: true },
      });
      const validIds = new Set(validLinks.map((l) => l.systemId));
      const invalid = systemIds.find((id) => !validIds.has(id));
      if (invalid) {
        throw new UnprocessableEntityException(
          `System ${invalid} is not associated with this demand's Client`,
        );
      }
    }

    const existing = await this.prisma.db.demandSystem.findMany({ where: { demandId } });
    const desired = new Set(systemIds);
    await this.prisma.db.$transaction([
      ...existing
        .filter((link) => !desired.has(link.systemId))
        .map((link) =>
          this.prisma.db.demandSystem.update({
            where: { demandId_systemId: { demandId, systemId: link.systemId } },
            data: { stAtivo: false },
          }),
        ),
      ...systemIds.map((systemId) =>
        this.prisma.db.demandSystem.upsert({
          where: { demandId_systemId: { demandId, systemId } },
          update: { stAtivo: true },
          create: { demandId, systemId },
        }),
      ),
    ]);
    return this.getAvailableAndSelectedSystems(demandId);
  }

  /**
   * spec FR-009: `available` = active SystemArtifacts across the demand's
   * currently-selected Systems. follow-up: a Sistema can carry hundreds of
   * Artefatos (real case: ~300) — without a `search` term this returns only
   * the first 50 (by name) rather than the full set, so the SPEC screen
   * never renders an unbounded checkbox list; the frontend prompts the
   * analyst to search by name to narrow it down.
   *
   * follow-up: `systemIds` lets the SPEC screen pass its current (not yet
   * saved) System checkboxes, so the Artefato autocomplete already lists
   * results for a System the analyst just checked but hasn't clicked
   * "Salvar seleção" for yet — without it, this fell back to the
   * still-persisted `DemandSystem` selection and looked empty. Still
   * validated against the demand's Client so an arbitrary id can't leak
   * another System's catalog.
   */
  async getAvailableAndSelectedSystemArtifacts(
    demandId: string,
    search?: string,
    systemIds?: string[],
  ) {
    let resolvedSystemIds: string[];
    if (systemIds) {
      if (systemIds.length === 0) {
        resolvedSystemIds = [];
      } else {
        const demand = await this.get(demandId);
        const validLinks = await this.prisma.db.clientSystem.findMany({
          where: { clientId: demand.clientId, systemId: { in: systemIds }, stAtivo: true },
        });
        resolvedSystemIds = validLinks.map((l) => l.systemId);
      }
    } else {
      const selectedSystems = await this.prisma.db.demandSystem.findMany({
        where: { demandId, stAtivo: true },
      });
      resolvedSystemIds = selectedSystems.map((l) => l.systemId);
    }

    const [available, selectedLinks] = await Promise.all([
      resolvedSystemIds.length
        ? this.prisma.db.systemArtifact.findMany({
            where: {
              systemId: { in: resolvedSystemIds },
              stAtivo: true,
              ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
            },
            orderBy: { name: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      this.prisma.db.demandSystemArtifact.findMany({
        where: { demandId, stAtivo: true },
        include: { systemArtifact: true },
      }),
    ]);
    return { available, selected: selectedLinks.map((l) => l.systemArtifact) };
  }

  /** spec FR-012/SC-006: reject any SystemArtifact whose System isn't in the demand's current selection. */
  async setSelectedSystemArtifacts(demandId: string, systemArtifactIds: string[]) {
    await this.get(demandId);
    if (systemArtifactIds.length > 0) {
      const artifacts = await this.prisma.db.systemArtifact.findMany({
        where: { id: { in: systemArtifactIds } },
      });
      const selectedSystems = await this.prisma.db.demandSystem.findMany({
        where: { demandId, stAtivo: true },
      });
      const selectedSystemIds = new Set(selectedSystems.map((l) => l.systemId));
      const invalid = artifacts.find((a) => !selectedSystemIds.has(a.systemId));
      if (invalid) {
        throw new UnprocessableEntityException(
          `SystemArtifact ${invalid.id} belongs to a System not selected for this demand`,
        );
      }
    }

    const existing = await this.prisma.db.demandSystemArtifact.findMany({ where: { demandId } });
    const desired = new Set(systemArtifactIds);
    await this.prisma.db.$transaction([
      ...existing
        .filter((link) => !desired.has(link.systemArtifactId))
        .map((link) =>
          this.prisma.db.demandSystemArtifact.update({
            where: {
              demandId_systemArtifactId: { demandId, systemArtifactId: link.systemArtifactId },
            },
            data: { stAtivo: false },
          }),
        ),
      ...systemArtifactIds.map((systemArtifactId) =>
        this.prisma.db.demandSystemArtifact.upsert({
          where: { demandId_systemArtifactId: { demandId, systemArtifactId } },
          update: { stAtivo: true },
          create: { demandId, systemArtifactId },
        }),
      ),
    ]);
    return this.getAvailableAndSelectedSystemArtifacts(demandId);
  }
}
