import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateSpecificationVersionDto } from "./dto/specification.dto";

@Injectable()
export class SpecificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForDemand(demandId: string) {
    return this.prisma.db.specification.findMany({ where: { demandId } });
  }

  private async getSpecification(id: string) {
    const specification = await this.prisma.db.specification.findUnique({ where: { id } });
    if (!specification) throw new NotFoundException(`Specification ${id} not found`);
    return specification;
  }

  listVersions(specificationId: string) {
    return this.prisma.db.specificationVersion.findMany({
      where: { specificationId },
      orderBy: { versionNumber: "asc" },
    });
  }

  /**
   * spec FR-010: never overwrites — always inserts a new version row with an
   * incremented `version_number`, and repoints `Specification.currentVersionId`.
   */
  async createVersion(
    specificationId: string,
    dto: CreateSpecificationVersionDto,
    authorUserId?: string,
  ) {
    const specification = await this.getSpecification(specificationId);
    const lastVersion = await this.prisma.db.specificationVersion.findFirst({
      where: { specificationId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const newVersion = await this.prisma.db.specificationVersion.create({
      data: {
        specificationId,
        versionNumber: nextVersionNumber,
        content: dto.content,
        reason: dto.reason,
        authorUserId,
      },
    });

    await this.prisma.db.specification.update({
      where: { id: specification.id },
      data: { currentVersionId: newVersion.id },
    });

    return newVersion;
  }

  /** spec FR-011: simple line-level diff between any two versions. */
  async diff(specificationId: string, versionA: number, versionB: number) {
    const [a, b] = await Promise.all([
      this.getVersionByNumber(specificationId, versionA),
      this.getVersionByNumber(specificationId, versionB),
    ]);

    const linesA = a.content.split("\n");
    const linesB = b.content.split("\n");
    const setA = new Set(linesA);
    const setB = new Set(linesB);

    return {
      additions: linesB.filter((line) => !setA.has(line)),
      deletions: linesA.filter((line) => !setB.has(line)),
    };
  }

  /**
   * spec FR-011: restoring a prior version creates a NEW version copying its
   * content — never deletes or mutates the versions created after it.
   */
  async restore(specificationId: string, versionNumber: number, actorUserId?: string) {
    const target = await this.getVersionByNumber(specificationId, versionNumber);
    return this.createVersion(
      specificationId,
      { content: target.content, reason: `Restored from version ${versionNumber}` },
      actorUserId,
    );
  }

  private async getVersionByNumber(specificationId: string, versionNumber: number) {
    const version = await this.prisma.db.specificationVersion.findUnique({
      where: { specificationId_versionNumber: { specificationId, versionNumber } },
    });
    if (!version) {
      throw new BadRequestException(
        `Specification ${specificationId} has no version ${versionNumber}`,
      );
    }
    return version;
  }
}
