import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { WorkspacesService } from "./workspaces.service";

@ApiTags("workspaces")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /** spec 002 FR-013/contracts/console-lists.md. */
  @Get()
  list(
    @Query("demand_id") demandId?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.workspacesService.list(
      demandId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.workspacesService.get(id);
  }

  @Get(":id/tree")
  tree(@Param("id") id: string) {
    return this.workspacesService.tree(id);
  }

  @Get(":id/files")
  file(@Param("id") id: string, @Query("path") path: string) {
    return this.workspacesService.readFile(id, path);
  }
}
