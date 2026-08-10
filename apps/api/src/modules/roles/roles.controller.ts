import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { RolesService } from "./roles.service";
import { SetRolePermissionsDto } from "./dto/role.dto";

/** feature 004 (contracts/permissions.md): admin-only, same gating precedent as Settings. */
@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles("admin")
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("roles")
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get("permissions")
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get("roles/:id/permissions")
  listRolePermissions(@Param("id") id: string) {
    return this.rolesService.listRolePermissions(id);
  }

  @Put("roles/:id/permissions")
  setRolePermissions(@Param("id") id: string, @Body() dto: SetRolePermissionsDto) {
    return this.rolesService.setRolePermissions(id, dto.permissionNames);
  }
}
