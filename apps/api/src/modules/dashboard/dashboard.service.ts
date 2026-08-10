import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const OPEN_STATUSES = ["NEW"];
const SPECIFICATION_STATUSES = ["SPECIFICATION", "CLARIFICATION", "PLANNING", "CHECKLIST"];
const DEVELOPMENT_STATUSES = ["DEVELOPMENT", "TESTING", "COMMIT", "PULL_REQUEST"];
const BLOCKED_STATUSES = ["BLOCKED", "FAILED"];

/** spec 002 FR-006/FR-007/research.md §7: server-side aggregation, never client-side paging. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(recentLimit = 10) {
    const [
      grouped,
      recentDemands,
      totalDemands,
      pullRequestsOpen,
      testsFailing,
      agentsRunning,
      byClientRaw,
      avgTimePerStage,
    ] = await Promise.all([
      this.prisma.db.demand.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.db.demand.findMany({ orderBy: { updatedAt: "desc" }, take: recentLimit }),
      this.prisma.db.demand.count(),
      this.prisma.db.pullRequest.count({ where: { status: "OPEN" } }),
      this.prisma.db.testExecution.count({ where: { status: "FAILED" } }),
      this.prisma.db.agentExecution.count({ where: { status: "RUNNING" } }),
      this.prisma.db.demand.groupBy({ by: ["clientId"], _count: { clientId: true } }),
      this.computeAvgTimePerStage(),
    ]);

    const countByStatuses = (statuses: string[]) =>
      grouped
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count.status, 0);

    const clientIds = byClientRaw.map((g) => g.clientId);
    const clients = await this.prisma.db.client.findMany({ where: { id: { in: clientIds } } });
    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

    return {
      stageCounts: grouped.map((g) => ({ stage: g.status, count: g._count.status })),
      recentDemands,
      // feature 004 FR-009/FR-010/FR-011/FR-012
      totals: {
        all: totalDemands,
        open: countByStatuses(OPEN_STATUSES),
        inSpecification: countByStatuses(SPECIFICATION_STATUSES),
        inDevelopment: countByStatuses(DEVELOPMENT_STATUSES),
        blocked: countByStatuses(BLOCKED_STATUSES),
      },
      pullRequestsOpen,
      testsFailing,
      agentsRunning,
      byClient: byClientRaw.map((g) => ({
        clientId: g.clientId,
        clientName: clientNameById.get(g.clientId) ?? g.clientId,
        count: g._count.clientId,
      })),
      avgTimePerStage,
    };
  }

  /**
   * feature 004 FR-011 (research.md §6): pairs consecutive STAGE_TRANSITION
   * AuditLog rows per demand (written by WorkflowsService) to compute how
   * long each demand spent in a stage, then averages per stage across all
   * demands.
   */
  private async computeAvgTimePerStage() {
    const transitions = await this.prisma.db.auditLog.findMany({
      where: { action: "STAGE_TRANSITION", entityType: "demands" },
      orderBy: [{ entityId: "asc" }, { occurredAt: "asc" }],
    });

    const durationsByStage = new Map<string, number[]>();
    const byDemand = new Map<string, typeof transitions>();
    for (const row of transitions) {
      if (!row.entityId) continue;
      const list = byDemand.get(row.entityId) ?? [];
      list.push(row);
      byDemand.set(row.entityId, list);
    }

    for (const rows of byDemand.values()) {
      for (let i = 0; i < rows.length - 1; i++) {
        const current = rows[i];
        const next = rows[i + 1];
        const stage = (current.after as { status?: string } | null)?.status;
        if (!stage) continue;
        const hours =
          (next.occurredAt.getTime() - current.occurredAt.getTime()) / (1000 * 60 * 60);
        const list = durationsByStage.get(stage) ?? [];
        list.push(hours);
        durationsByStage.set(stage, list);
      }
    }

    return [...durationsByStage.entries()].map(([stage, hours]) => ({
      stage,
      avgHours: hours.reduce((sum, h) => sum + h, 0) / hours.length,
    }));
  }
}
