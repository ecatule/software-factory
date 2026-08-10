import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { ClientsService } from "./clients.service";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";
import { SetClientSystemsDto } from "./dto/client-system.dto";

@ApiTags("clients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list() {
    return this.clientsService.list();
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.clientsService.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  /** feature 005 (contracts/client-system-association.md). */
  @Get(":id/systems")
  @RequirePermission("SYSTEM_READ")
  listSystems(@Param("id") id: string) {
    return this.clientsService.listSystems(id);
  }

  @Put(":id/systems")
  @RequirePermission("SYSTEM_WRITE")
  setSystems(@Param("id") id: string, @Body() dto: SetClientSystemsDto) {
    return this.clientsService.setSystems(id, dto.systemIds);
  }
}
