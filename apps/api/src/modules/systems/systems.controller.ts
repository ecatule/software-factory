import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { SystemsService } from "./systems.service";
import {
  BulkCreateSystemArtifactsDto,
  CreateSystemArtifactDto,
  CreateSystemDto,
  UpdateSystemArtifactDto,
  UpdateSystemDto,
} from "./dto/system.dto";

/** feature 005 (contracts/systems-artifacts.md): Sistemas/Artefatos catalog CRUD. */
@ApiTags("systems")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SystemsController {
  constructor(private readonly systemsService: SystemsService) {}

  @Get("systems")
  @RequirePermission("SYSTEM_READ")
  list(@Query("page") page?: string, @Query("page_size") pageSize?: string) {
    return this.systemsService.list(
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post("systems")
  @RequirePermission("SYSTEM_WRITE")
  create(@Body() dto: CreateSystemDto) {
    return this.systemsService.create(dto);
  }

  /** follow-up: the edit screen is now a dedicated page (`/systems/:id`), not a modal fed from the list. */
  @Get("systems/:id")
  @RequirePermission("SYSTEM_READ")
  get(@Param("id") id: string) {
    return this.systemsService.get(id);
  }

  @Patch("systems/:id")
  @RequirePermission("SYSTEM_WRITE")
  update(@Param("id") id: string, @Body() dto: UpdateSystemDto) {
    return this.systemsService.update(id, dto);
  }

  @Get("systems/:id/artifacts")
  @RequirePermission("SYSTEM_ARTIFACT_READ")
  listArtifacts(
    @Param("id") id: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.systemsService.listArtifacts(
      id,
      search,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post("systems/:id/artifacts")
  @RequirePermission("SYSTEM_ARTIFACT_WRITE")
  createArtifact(@Param("id") id: string, @Body() dto: CreateSystemArtifactDto) {
    return this.systemsService.createArtifact(id, dto);
  }

  /** follow-up: bulk import from a spreadsheet (parsed to JSON rows client-side). */
  @Post("systems/:id/artifacts/bulk")
  @RequirePermission("SYSTEM_ARTIFACT_WRITE")
  createArtifactsBulk(@Param("id") id: string, @Body() dto: BulkCreateSystemArtifactsDto) {
    return this.systemsService.createArtifactsBulk(id, dto.artifacts);
  }

  @Patch("system-artifacts/:id")
  @RequirePermission("SYSTEM_ARTIFACT_WRITE")
  updateArtifact(@Param("id") id: string, @Body() dto: UpdateSystemArtifactDto) {
    return this.systemsService.updateArtifact(id, dto);
  }
}
