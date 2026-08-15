import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import {
  CreateSystemArtifactDto,
  CreateSystemDto,
  UpdateSystemArtifactDto,
  UpdateSystemDto,
} from "./dto/system.dto";

/** feature 005 User Story 1: System/SystemArtifact catalog CRUD. */
@Injectable()
export class SystemsService {
  constructor(private readonly prisma: PrismaService) {}

  list(page?: number, pageSize?: number) {
    return paginate(
      (skip, take) => this.prisma.db.system.findMany({ orderBy: { name: "asc" }, skip, take }),
      () => this.prisma.db.system.count(),
      page,
      pageSize,
    );
  }

  create(dto: CreateSystemDto) {
    return this.prisma.db.system.create({ data: dto });
  }

  /** follow-up: the System edit screen is now a full page, not a modal — needs a single-record fetch. */
  async get(id: string) {
    const system = await this.prisma.db.system.findUnique({ where: { id } });
    if (!system) throw new NotFoundException(`System ${id} not found`);
    return system;
  }

  async update(id: string, dto: UpdateSystemDto) {
    await this.get(id);
    return this.prisma.db.system.update({ where: { id }, data: dto });
  }

  /**
   * feature 005 follow-up: a Sistema can carry hundreds of Artefatos (real
   * case: ~300 for "Vexur") — paginated + searchable by name, instead of the
   * original unpaginated `findMany` that shipped an unbounded list to the UI.
   */
  listArtifacts(systemId: string, search?: string, page?: number, pageSize?: number) {
    const where = {
      systemId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };
    return paginate(
      (skip, take) =>
        this.prisma.db.systemArtifact.findMany({
          where,
          orderBy: { name: "asc" },
          skip,
          take,
          include: { repositories: { where: { stAtivo: true } } },
        }),
      () => this.prisma.db.systemArtifact.count({ where }),
      page,
      pageSize,
    );
  }

  /**
   * spec FR-003: an active SystemArtifact cannot be created under an
   * inactive System. `repositoryIds` (follow-up): links this catalog
   * artifact to real Repository row(s) — same nested-create pattern as
   * `ArtifactsService.create` (apps/api/src/modules/artifacts/artifacts.service.ts).
   */
  async createArtifact(systemId: string, dto: CreateSystemArtifactDto) {
    const system = await this.get(systemId);
    if (!system.stAtivo) {
      throw new UnprocessableEntityException(
        `Cannot create an artifact under inactive System ${systemId}`,
      );
    }
    const { repositoryIds, ...rest } = dto;
    return this.prisma.db.systemArtifact.create({
      data: {
        systemId,
        ...rest,
        repositories: repositoryIds
          ? { create: repositoryIds.map((repositoryId) => ({ repositoryId })) }
          : undefined,
      },
      include: { repositories: { where: { stAtivo: true } } },
    });
  }

  /**
   * follow-up: bulk import so an admin can upload a spreadsheet of known
   * Artefatos instead of creating them one by one — same FR-003 rule
   * applies. Returns per-row results so the UI can report partial failures
   * (e.g. a row with a blank name) without losing the rows that succeeded.
   */
  async createArtifactsBulk(systemId: string, rows: CreateSystemArtifactDto[]) {
    const system = await this.get(systemId);
    if (!system.stAtivo) {
      throw new UnprocessableEntityException(
        `Cannot create artifacts under inactive System ${systemId}`,
      );
    }

    const results: { row: number; status: "created" | "error"; name: string; message?: string }[] = [];
    for (const [index, dto] of rows.entries()) {
      try {
        if (!dto.name?.trim() || !dto.type?.trim()) {
          throw new Error("name and type are required");
        }
        // follow-up: bulk CSV import doesn't collect repositoryIds (no
        // column for it) — named fields only, not a `...dto` spread, since
        // `repositoryIds` isn't a scalar column on SystemArtifact (would
        // need the nested-create shape `createArtifact` uses instead).
        await this.prisma.db.systemArtifact.create({
          data: {
            systemId,
            name: dto.name,
            type: dto.type,
            technology: dto.technology,
            description: dto.description,
          },
        });
        results.push({ row: index + 1, status: "created", name: dto.name });
      } catch (error) {
        results.push({
          row: index + 1,
          status: "error",
          name: dto.name ?? "(blank)",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return results;
  }

  /**
   * follow-up: `repositoryIds`, when provided, REPLACES the full active set
   * of linked repositories (not additive) — matches editing a form field,
   * not appending. The project's soft-delete guard
   * (`common/prisma/soft-delete.extension.ts`) blocks `delete()`/
   * `deleteMany()` on every model, so "remove a link" is a `stAtivo: false`
   * update, not a physical delete — same upsert-then-deactivate pattern
   * `DemandsService.setSelectedSystemArtifacts` already uses for
   * `DemandSystemArtifact`.
   */
  async updateArtifact(id: string, dto: UpdateSystemArtifactDto) {
    await this.getArtifact(id);
    const { repositoryIds, ...rest } = dto;
    if (repositoryIds) {
      const existing = await this.prisma.db.systemArtifactRepository.findMany({
        where: { systemArtifactId: id },
      });
      const desired = new Set(repositoryIds);
      await this.prisma.db.$transaction([
        ...existing
          .filter((link) => !desired.has(link.repositoryId))
          .map((link) =>
            this.prisma.db.systemArtifactRepository.update({
              where: {
                systemArtifactId_repositoryId: { systemArtifactId: id, repositoryId: link.repositoryId },
              },
              data: { stAtivo: false },
            }),
          ),
        ...repositoryIds.map((repositoryId) =>
          this.prisma.db.systemArtifactRepository.upsert({
            where: { systemArtifactId_repositoryId: { systemArtifactId: id, repositoryId } },
            update: { stAtivo: true },
            create: { systemArtifactId: id, repositoryId },
          }),
        ),
      ]);
    }
    return this.prisma.db.systemArtifact.update({
      where: { id },
      data: rest,
      include: { repositories: { where: { stAtivo: true } } },
    });
  }

  private async getArtifact(id: string) {
    const artifact = await this.prisma.db.systemArtifact.findUnique({ where: { id } });
    if (!artifact) throw new NotFoundException(`SystemArtifact ${id} not found`);
    return artifact;
  }
}
