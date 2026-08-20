import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const OPEN_STATUSES = ["NEW"];
const SPECIFICATION_STATUSES = ["SPECIFICATION", "CLARIFICATION", "PLANNING", "CHECKLIST"];
const DEVELOPMENT_STATUSES = ["DEVELOPMENT", "TESTING", "COMMIT", "PULL_REQUEST"];
const BLOCKED_STATUSES = ["BLOCKED", "FAILED"];
const WEEKDAY_LABELS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DAILY_ACTIVITY_DAYS = 7;

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
      dailyActivity,
      demandsReadyForProduction,
    ] = await Promise.all([
      this.prisma.db.demand.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.db.demand.findMany({ orderBy: { updatedAt: "desc" }, take: recentLimit }),
      this.prisma.db.demand.count(),
      this.prisma.db.pullRequest.count({ where: { status: "OPEN" } }),
      this.prisma.db.testExecution.count({ where: { status: "FAILED" } }),
      this.prisma.db.agentExecution.count({ where: { status: "RUNNING" } }),
      this.prisma.db.demand.groupBy({ by: ["clientId"], _count: { clientId: true } }),
      this.computeAvgTimePerStage(),
      this.computeDailyActivity(),
      this.countReadyForProduction(),
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
      dailyActivity,
      demandsReadyForProduction,
    };
  }

  /**
   * feature 006 (spec FR-015): mesma regra de `isReadyForProduction`, em
   * lote — usada aqui só pela contagem do resumo do dashboard, sem repetir
   * uma query por demanda.
   */
  private async countReadyForProduction(): Promise<number> {
    const candidates = await this.prisma.db.demand.findMany({
      where: { status: "READY_FOR_PRODUCTION" },
      select: { id: true },
    });
    if (candidates.length === 0) return 0;

    const failing = await this.prisma.db.functionalTestExecution.findMany({
      where: { demandId: { in: candidates.map((c) => c.id) }, status: "FAIL" },
      select: { demandId: true },
    });
    const failingDemandIds = new Set(failing.map((f) => f.demandId));
    return candidates.filter((c) => !failingDemandIds.has(c.id)).length;
  }

  /**
   * feature 006 (spec FR-015): "nenhuma demanda com pelo menos um resultado
   * de teste funcional em FAIL DEVE ser apresentada como pronta para
   * produção" — independente do `Demand.status` já ler
   * `READY_FOR_PRODUCTION` (nenhuma automação define esse estado sozinha
   * hoje, spec Assumptions; isto é o predicado que qualquer leitura de
   * "está pronta?" deve consultar).
   */
  async isReadyForProduction(demandId: string): Promise<boolean> {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    if (demand.status !== "READY_FOR_PRODUCTION") return false;

    const failingExecution = await this.prisma.db.functionalTestExecution.findFirst({
      where: { demandId, status: "FAIL" },
    });
    return !failingExecution;
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

  /**
   * Dashboard highlight ("destaque"): total system activity per day for the
   * last 7 days. `AuditLog.occurredAt` is the only field that captures many
   * distinct real actions across the whole system (not just demand stage
   * transitions, unlike `computeAvgTimePerStage` above) — no `action`/
   * `entityType` filter, so every audited action counts. Days with zero
   * activity are still included (not skipped) so the chart doesn't jump
   * over a quiet day. Bucketed in JS, same style as `computeAvgTimePerStage`
   * — no raw SQL/date_trunc anywhere else in this codebase, and at ~231
   * total AuditLog rows today a 7-day fetch-and-bucket is trivially cheap.
   */
  private async computeDailyActivity(): Promise<{ date: string; label: string; count: number }[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (DAILY_ACTIVITY_DAYS - 1));

    const rows = await this.prisma.db.auditLog.findMany({
      where: { occurredAt: { gte: start } },
      select: { occurredAt: true },
    });

    const countByDate = new Map<string, number>();
    for (const row of rows) {
      const key = row.occurredAt.toISOString().slice(0, 10);
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }

    const result: { date: string; label: string; count: number }[] = [];
    for (let i = 0; i < DAILY_ACTIVITY_DAYS; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      result.push({ date: key, label: WEEKDAY_LABELS_PT[day.getDay()], count: countByDate.get(key) ?? 0 });
    }
    return result;
  }
}
