import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
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

  /** feature 005 User Story 2 (FR-004): active Systems associated with this Client. */
  async listSystems(clientId: string) {
    await this.get(clientId);
    const links = await this.prisma.db.clientSystem.findMany({
      where: { clientId, stAtivo: true },
      include: { system: true },
    });
    return links.map((l) => l.system);
  }

  /**
   * spec FR-004/FR-005/FR-006: replaces the full associated-System set
   * (idempotent). Physical delete is forbidden platform-wide
   * (softDeleteGuardExtension) — soft-remove (stAtivo:false) + upsert, same
   * pattern already used for ProjectTechnology/RolePermission.
   */
  async setSystems(clientId: string, systemIds: string[]) {
    await this.get(clientId);
    const systems = await this.prisma.db.system.findMany({ where: { id: { in: systemIds } } });
    const inactive = systems.find((s) => !s.stAtivo);
    if (inactive) {
      throw new UnprocessableEntityException(`System ${inactive.id} is inactive`);
    }

    const desired = new Set(systems.map((s) => s.id));
    const existing = await this.prisma.db.clientSystem.findMany({ where: { clientId } });

    await this.prisma.db.$transaction([
      ...existing
        .filter((link) => !desired.has(link.systemId))
        .map((link) =>
          this.prisma.db.clientSystem.update({
            where: { clientId_systemId: { clientId, systemId: link.systemId } },
            data: { stAtivo: false },
          }),
        ),
      ...systems.map((system) =>
        this.prisma.db.clientSystem.upsert({
          where: { clientId_systemId: { clientId, systemId: system.id } },
          update: { stAtivo: true },
          create: { clientId, systemId: system.id },
        }),
      ),
    ]);
    return this.listSystems(clientId);
  }
}
