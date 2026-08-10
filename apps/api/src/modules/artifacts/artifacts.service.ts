import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { CreateArtifactDto, CreateArtifactFileDto, UpdateArtifactDto } from "./dto/artifact.dto";

@Injectable()
export class ArtifactsService {
  constructor(private readonly prisma: PrismaService) {}

  listForDemand(demandId: string) {
    return this.prisma.db.artifact.findMany({ where: { demandId }, include: { files: true } });
  }

  /** spec 002 FR-015: cross-demand artifact browsing, filterable by demand/type/status. */
  list(
    filters: { demandId?: string; type?: string; status?: string },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.ArtifactWhereInput = {
      demandId: filters.demandId,
      type: filters.type,
      status: filters.status,
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.artifact.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.artifact.count({ where }),
      page,
      pageSize,
    );
  }

  async get(id: string) {
    const artifact = await this.prisma.db.artifact.findUnique({ where: { id } });
    if (!artifact) throw new NotFoundException(`Artifact ${id} not found`);
    return artifact;
  }

  /**
   * spec FR-016: an artifact may reference multiple repositories, and a
   * repository already linked to another artifact is reused, not duplicated
   * — reuse happens naturally here because ArtifactRepository just stores
   * (artifactId, repositoryId) pairs; no new Repository row is created.
   */
  async create(demandId: string, dto: CreateArtifactDto) {
    return this.prisma.db.artifact.create({
      data: {
        demandId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        technology: dto.technology,
        path: dto.path,
        repositories: dto.repositoryIds
          ? { create: dto.repositoryIds.map((repositoryId) => ({ repositoryId })) }
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateArtifactDto) {
    await this.get(id);
    return this.prisma.db.artifact.update({ where: { id }, data: dto });
  }

  listFiles(artifactId: string) {
    return this.prisma.db.artifactFile.findMany({ where: { artifactId } });
  }

  /** spec FR-017: `reason` is enforced at the DTO layer (see CreateArtifactFileDto). */
  async addFile(artifactId: string, dto: CreateArtifactFileDto) {
    await this.get(artifactId);
    return this.prisma.db.artifactFile.create({
      data: {
        artifactId,
        filePath: dto.filePath,
        changeType: dto.changeType,
        reason: dto.reason,
      },
    });
  }

  /**
   * There is no separate ArtifactVersion table (deferred per data-model.md);
   * the artifact's change history is reconstructed from AuditLog instead.
   */
  async versions(artifactId: string) {
    await this.get(artifactId);
    return this.prisma.db.auditLog.findMany({
      where: { entityType: "artifacts", entityId: artifactId },
      orderBy: { occurredAt: "asc" },
    });
  }
}
