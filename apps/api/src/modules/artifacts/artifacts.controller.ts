import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { ArtifactsService } from "./artifacts.service";
import { CreateArtifactDto, CreateArtifactFileDto, UpdateArtifactDto } from "./dto/artifact.dto";

@ApiTags("artifacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("demands/:demandId/artifacts")
export class DemandArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get()
  list(@Param("demandId") demandId: string) {
    return this.artifactsService.listForDemand(demandId);
  }

  @Post()
  create(@Param("demandId") demandId: string, @Body() dto: CreateArtifactDto) {
    return this.artifactsService.create(demandId, dto);
  }
}

@ApiTags("artifacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("artifacts")
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  /** spec 002 FR-015/contracts/console-lists.md. */
  @Get()
  list(
    @Query("demand_id") demandId?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.artifactsService.list(
      { demandId, type, status },
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.artifactsService.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateArtifactDto) {
    return this.artifactsService.update(id, dto);
  }

  @Get(":id/files")
  listFiles(@Param("id") id: string) {
    return this.artifactsService.listFiles(id);
  }

  @Post(":id/files")
  addFile(@Param("id") id: string, @Body() dto: CreateArtifactFileDto) {
    return this.artifactsService.addFile(id, dto);
  }

  @Get(":id/versions")
  versions(@Param("id") id: string) {
    return this.artifactsService.versions(id);
  }
}
