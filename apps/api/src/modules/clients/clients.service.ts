import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.db.client.findMany({ orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const client = await this.prisma.db.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  create(dto: CreateClientDto) {
    return this.prisma.db.client.create({ data: dto });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.get(id);
    return this.prisma.db.client.update({ where: { id }, data: dto });
  }
}
