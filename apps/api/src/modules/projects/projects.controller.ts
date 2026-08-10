import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { SetProjectTechnologiesDto } from "../technologies/dto/technology.dto";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";

@ApiTags("projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Query("client_id") clientId?: string) {
    return this.projectsService.list(clientId);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projectsService.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  /** feature 003 FR-016: read by SpecificationWorkspace's technology context. */
  @Get(":id/technologies")
  listTechnologies(@Param("id") id: string) {
    return this.projectsService.listTechnologies(id);
  }

  @Put(":id/technologies")
  setTechnologies(@Param("id") id: string, @Body() dto: SetProjectTechnologiesDto) {
    return this.projectsService.setTechnologies(id, dto.technologyIds);
  }
}
