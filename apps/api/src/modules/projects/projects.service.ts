import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** spec 002 FR-009: filterable by client for the Projects screen. */
  list(clientId?: string) {
    return this.prisma.db.project.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const project = await this.prisma.db.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.db.project.create({
      data: {
        clientId: dto.clientId,
        name: dto.name,
        technologies: dto.technologies ?? [],
        requiredTestSuites: dto.requiredTestSuites ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.get(id);
    return this.prisma.db.project.update({ where: { id }, data: dto });
  }

  /** feature 003 FR-016: what the AI specification context reads (SpecificationContextService). */
  async listTechnologies(projectId: string) {
    await this.get(projectId);
    const links = await this.prisma.db.projectTechnology.findMany({
      where: { projectId, stAtivo: true },
      include: { technology: true },
    });
    return links.map((l) => l.technology);
  }

  /**
   * feature 003 FR-015: replaces the full association set (idempotent).
   * Physical delete is forbidden platform-wide (softDeleteGuardExtension),
   * so a removed association is soft-removed (`stAtivo: false`) rather than
   * deleted, and re-adding it later flips it back via upsert.
   */
  async setTechnologies(projectId: string, technologyIds: string[]) {
    await this.get(projectId);
    const desired = new Set(technologyIds);
    const existing = await this.prisma.db.projectTechnology.findMany({ where: { projectId } });

    await this.prisma.db.$transaction([
      ...existing
        .filter((link) => !desired.has(link.technologyId))
        .map((link) =>
          this.prisma.db.projectTechnology.update({
            where: { projectId_technologyId: { projectId, technologyId: link.technologyId } },
            data: { stAtivo: false },
          }),
        ),
      ...technologyIds.map((technologyId) =>
        this.prisma.db.projectTechnology.upsert({
          where: { projectId_technologyId: { projectId, technologyId } },
          update: { stAtivo: true },
          create: { projectId, technologyId },
        }),
      ),
    ]);
    return this.listTechnologies(projectId);
  }
}
