import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RepositoriesService } from "./repositories.service";
import { UpdateRepositoryDto } from "./dto/repository.dto";

@ApiTags("repositories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("repositories")
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  list(
    @Query("project_id") projectId?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.repositoriesService.list(projectId, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.repositoriesService.get(id);
  }

  @Get(":id/artifacts")
  artifacts(@Param("id") id: string) {
    return this.repositoriesService.artifacts(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRepositoryDto) {
    return this.repositoriesService.update(id, dto);
  }
}
