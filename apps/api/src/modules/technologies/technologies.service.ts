import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { CreateTechnologyDto, UpdateTechnologyDto } from "./dto/technology.dto";

@Injectable()
export class TechnologiesService {
  constructor(private readonly prisma: PrismaService) {}

  /** spec User Story 2 (FR-014): paginated per the platform-wide SC-007-style cap. */
  list(page?: number, pageSize?: number) {
    return paginate(
      (skip, take) => this.prisma.db.technology.findMany({ orderBy: { name: "asc" }, skip, take }),
      () => this.prisma.db.technology.count(),
      page,
      pageSize,
    );
  }

  async get(id: string) {
    const technology = await this.prisma.db.technology.findUnique({ where: { id } });
    if (!technology) throw new NotFoundException(`Technology ${id} not found`);
    return technology;
  }

  create(dto: CreateTechnologyDto) {
    return this.prisma.db.technology.create({ data: dto });
  }

  async update(id: string, dto: UpdateTechnologyDto) {
    await this.get(id);
    return this.prisma.db.technology.update({ where: { id }, data: dto });
  }
}
