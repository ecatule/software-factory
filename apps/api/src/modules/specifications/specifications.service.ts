import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IncrementsService } from "../increments/increments.service";
import {
  ApproveSpecificationVersionDto,
  CreateSpecificationVersionDto,
  UploadSpecificationVersionDto,
} from "./dto/specification.dto";

const TERMINAL_STATUSES = ["APPROVED", "REJECTED", "SUPERSEDED"];

@Injectable()
export class SpecificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly increments: IncrementsService,
  ) {}

  async listForDemand(demandId: string) {
    return this.prisma.db.specification.findMany({ where: { demandId } });
  }

  /** feature 003: exposes `demandId` so the frontend can drive the copilot flow. */
  async get(id: string) {
    return this.getSpecification(id);
  }

  /**
   * feature 003 (live-validation finding): a brand-new demand has no
   * `Specification` row yet — spec.md Acceptance Scenario 1 explicitly
   * requires the workspace to be reachable for "uma demanda sem nenhuma
   * especificação aprovada ainda". Lazily upserts, mirroring
   * `IncrementsService.ensureCurrentIncrement()`.
   */
  ensureForDemand(demandId: string, documentType: "SPEC" | "PLAN") {
    return this.prisma.db.specification.upsert({
      where: { demandId_documentType: { demandId, documentType } },
      update: {},
      create: { demandId, documentType },
    });
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
   * feature 003: also tags the version with its increment/status/source
   * (data-model.md "Extended: SpecificationVersion") — existing callers keep
   * working via the defaults below.
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

    const incrementId =
      dto.incrementId ?? (await this.increments.ensureCurrentIncrement(specification.demandId)).id;

    const newVersion = await this.prisma.db.specificationVersion.create({
      data: {
        specificationId,
        versionNumber: nextVersionNumber,
        content: dto.content,
        reason: dto.reason,
        authorUserId,
        incrementId,
        status: "GENERATED",
        source: dto.source ?? "HUMAN_EDITED",
      },
    });

    await this.prisma.db.specification.update({
      where: { id: specification.id },
      data: { currentVersionId: newVersion.id },
    });

    return newVersion;
  }

  /** spec FR-024/FR-025 (User Story 1, clarify addition): the direct-upload alternative. */
  async uploadVersion(specificationId: string, dto: UploadSpecificationVersionDto) {
    const content = dto.specifyMarkdown ?? dto.planMarkdown;
    if (!content || !content.trim()) {
      throw new BadRequestException(
        "Upload requires non-empty specifyMarkdown or planMarkdown content.",
      );
    }
    return this.createVersion(
      specificationId,
      { content, reason: dto.reason ?? "Uploaded from an external source", source: "UPLOADED" },
    );
  }

  /** spec FR-010–FR-013: only the latest, non-terminal version may be approved. */
  async approve(
    specificationId: string,
    versionNumber: number,
    dto: ApproveSpecificationVersionDto,
    approverUserId?: string,
  ) {
    const specification = await this.getSpecification(specificationId);
    const target = await this.getVersionByNumber(specificationId, versionNumber);

    if (TERMINAL_STATUSES.includes(target.status)) {
      throw new ConflictException(
        `Specification version ${versionNumber} is already ${target.status} and cannot be modified.`,
      );
    }
    const latest = await this.prisma.db.specificationVersion.findFirst({
      where: { specificationId },
      orderBy: { versionNumber: "desc" },
    });
    if (latest && latest.versionNumber !== versionNumber) {
      throw new ConflictException(
        `Specification version ${versionNumber} is not the latest version (${latest.versionNumber}) — refresh before approving.`,
      );
    }

    const approved = await this.prisma.db.specificationVersion.update({
      where: { id: target.id },
      data: {
        status: "APPROVED",
        approvedBy: approverUserId,
        approvedAt: new Date(),
        approvalComment: dto.comment,
      },
    });

    // spec 003 contracts/specification-copilot.md: once both SPEC and PLAN
    // for this increment are APPROVED, the increment itself is COMPLETED.
    if (approved.incrementId) {
      const documentTypes = await this.prisma.db.specification.findMany({
        where: { demandId: specification.demandId, documentType: { in: ["SPEC", "PLAN"] } },
      });
      const approvedForIncrement = await this.prisma.db.specificationVersion.findMany({
        where: { incrementId: approved.incrementId, status: "APPROVED" },
      });
      const bothApproved = documentTypes.every((spec) =>
        approvedForIncrement.some((v) => v.specificationId === spec.id),
      );
      if (documentTypes.length >= 2 && bothApproved) {
        await this.prisma.db.increment.update({
          where: { id: approved.incrementId },
          data: { status: "COMPLETED" },
        });
      }
    }

    return approved;
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
