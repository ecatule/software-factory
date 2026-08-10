import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** feature 004 FR-005: so the assignment UI knows which roles exist (missing from the original contract). */
  listRoles() {
    return this.prisma.db.role.findMany({ orderBy: { name: "asc" } });
  }

  /** feature 004 FR-004: the fixed catalog used to populate the assignment UI. */
  listPermissions() {
    return this.prisma.db.permission.findMany({ orderBy: { name: "asc" } });
  }

  async listRolePermissions(roleId: string) {
    await this.getRole(roleId);
    const links = await this.prisma.db.rolePermission.findMany({
      where: { roleId, stAtivo: true },
      include: { permission: true },
    });
    return links.map((l) => l.permission);
  }

  /**
   * feature 004 FR-005 (/speckit.analyze finding G1): soft-remove revoked
   * permissions (`stAtivo: false`) instead of `deleteMany` — physical
   * delete is blocked platform-wide even for join tables, the same issue
   * already fixed for ProjectTechnology in feature 003.
   */
  async setRolePermissions(roleId: string, permissionNames: string[]) {
    await this.getRole(roleId);
    const permissions = await this.prisma.db.permission.findMany({
      where: { name: { in: permissionNames } },
    });
    const desired = new Set(permissions.map((p) => p.id));
    const existing = await this.prisma.db.rolePermission.findMany({ where: { roleId } });

    await this.prisma.db.$transaction([
      ...existing
        .filter((link) => !desired.has(link.permissionId))
        .map((link) =>
          this.prisma.db.rolePermission.update({
            where: { roleId_permissionId: { roleId, permissionId: link.permissionId } },
            data: { stAtivo: false },
          }),
        ),
      ...permissions.map((permission) =>
        this.prisma.db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: { stAtivo: true },
          create: { roleId, permissionId: permission.id },
        }),
      ),
    ]);
    return this.listRolePermissions(roleId);
  }

  private async getRole(id: string) {
    const role = await this.prisma.db.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }
}
