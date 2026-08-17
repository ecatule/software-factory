import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class IncrementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** excludes deactivated increments — same convention as SpecificationVersion's `stAtivo: true` filtering elsewhere (see deactivateVersion). Otherwise a deactivated increment, if it happened to have the highest `number`, would keep being treated as "current" by callers that take the list's last item (e.g. SummaryTab.tsx). */
  list(demandId: string) {
    return this.prisma.db.increment.findMany({
      where: { demandId, stAtivo: true },
      orderBy: { number: "asc" },
    });
  }

  /**
   * feature 003 (research.md §8/§9, /speckit.analyze finding F1): lives in
   * Foundational rather than only inside the increment-creation endpoint
   * (T031) because User Story 1's AI round (T013) and upload (T015) paths
   * also need a valid `incrementId`, independently of User Story 3.
   */
  async ensureCurrentIncrement(demandId: string) {
    const demand = await this.prisma.db.demand.findUnique({
      where: { id: demandId },
      include: { currentIncrement: true },
    });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);
    if (demand.currentIncrement) return demand.currentIncrement;

    const increment = await this.prisma.db.increment.create({
      data: { demandId, number: 1, reason: "Especificação inicial da demanda" },
    });
    await this.prisma.db.demand.update({
      where: { id: demandId },
      data: { currentIncrementId: increment.id },
    });
    return increment;
  }

  /** spec FR-017/FR-018/FR-019: the explicit "criar incremento" action (User Story 3). */
  async createNext(demandId: string, reason: string, title?: string) {
    const current = await this.ensureCurrentIncrement(demandId);

    const latestApproved = await this.prisma.db.specificationVersion.findMany({
      where: { incrementId: current.id, status: "APPROVED" },
      distinct: ["specificationId"],
    });
    const specifications = await this.prisma.db.specification.findMany({
      where: { demandId, documentType: { in: ["SPEC", "PLAN"] } },
    });
    const bothApproved = specifications.every((spec) =>
      latestApproved.some((v) => v.specificationId === spec.id),
    );
    if (specifications.length < 2 || !bothApproved) {
      throw new ConflictException(
        `Increment ${current.number} of demand ${demandId} does not yet have an approved ` +
          "SPEC and PLAN — cannot start a new increment without an approved base (FR-018).",
      );
    }

    const [latestSpecVersion, latestPlanVersion] = await Promise.all([
      this.prisma.db.specificationVersion.findFirst({
        where: { specification: { demandId, documentType: "SPEC" }, status: "APPROVED" },
        orderBy: { versionNumber: "desc" },
      }),
      this.prisma.db.specificationVersion.findFirst({
        where: { specification: { demandId, documentType: "PLAN" }, status: "APPROVED" },
        orderBy: { versionNumber: "desc" },
      }),
    ]);

    // `number` is unique per demand regardless of `stAtivo` (@@unique([demandId, number])
    // is a hard DB constraint) — `current.number + 1` collides once a deactivated
    // increment already occupies that number, so the next number is derived from the
    // highest `number` ever used for this demand, active or not.
    const highest = await this.prisma.db.increment.aggregate({
      where: { demandId },
      _max: { number: true },
    });
    const increment = await this.prisma.db.increment.create({
      data: {
        demandId,
        number: (highest._max.number ?? current.number) + 1,
        title,
        reason,
        baseSpecificationVersionId: latestSpecVersion?.id ?? latestPlanVersion?.id,
      },
    });
    await this.prisma.db.demand.update({
      where: { id: demandId },
      data: { currentIncrementId: increment.id },
    });
    return increment;
  }
}
