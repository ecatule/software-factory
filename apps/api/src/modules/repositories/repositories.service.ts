import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

/** spec 002 FR-024/FR-025: repositories were only ever created implicitly by US6/US8's Developer Agent (001) — never listed. */
@Injectable()
export class RepositoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string | undefined, page: number, pageSize: number) {
    const where = projectId ? { projectId } : undefined;
    return paginate(
      (skip, take) =>
        this.prisma.db.repository.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      () => this.prisma.db.repository.count({ where }),
      page,
      pageSize,
    );
  }

  async get(id: string) {
    const repository = await this.prisma.db.repository.findUnique({ where: { id } });
    if (!repository) throw new NotFoundException(`Repository ${id} not found`);
    return repository;
  }

  /** spec 001 FR-016's N:N artifact↔repository relationship, made visible. */
  async artifacts(id: string) {
    await this.get(id);
    const links = await this.prisma.db.artifactRepository.findMany({
      where: { repositoryId: id },
      include: { artifact: true },
    });
    return links.map((l) => l.artifact);
  }
}
