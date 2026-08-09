import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/** spec 002 FR-006/FR-007/research.md §7: server-side aggregation, never client-side paging. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(recentLimit = 10) {
    const [grouped, recentDemands] = await Promise.all([
      this.prisma.db.demand.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.db.demand.findMany({
        orderBy: { updatedAt: "desc" },
        take: recentLimit,
      }),
    ]);

    return {
      stageCounts: grouped.map((g) => ({ stage: g.status, count: g._count.status })),
      recentDemands,
    };
  }
}
