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
}
