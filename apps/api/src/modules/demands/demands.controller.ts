import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { DemandType } from "@prisma/client";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { WorkflowsService } from "../workflows/workflows.service";
import { SpecificationsService } from "../specifications/specifications.service";
import { ArtifactsService } from "../artifacts/artifacts.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DemandsService } from "./demands.service";
import { CreateDemandDto, UpdateDemandDto } from "./dto/demand.dto";

@ApiTags("demands")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("demands")
export class DemandsController {
  constructor(
    private readonly demandsService: DemandsService,
    private readonly workspacesService: WorkspacesService,
    private readonly workflowsService: WorkflowsService,
    private readonly specificationsService: SpecificationsService,
    private readonly artifactsService: ArtifactsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(
    @Query("client_id") clientId?: string,
    @Query("project_id") projectId?: string,
    @Query("status") status?: string,
    @Query("type") type?: DemandType,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.demandsService.list({
      clientId,
      projectId,
      status,
      type,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateDemandDto) {
    return this.demandsService.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.demandsService.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDemandDto) {
    return this.demandsService.update(id, dto);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.demandsService.timeline(id);
  }

  /**
   * spec FR-013: called once a demand's plan is approved. Idempotent —
   * returns the existing workspace if one was already created.
   */
  @Post(":id/workspace")
  createWorkspace(@Param("id") id: string) {
    return this.workspacesService.createForDemand(id);
  }

  @Get(":id/workspace")
  async getWorkspace(@Param("id") id: string) {
    await this.demandsService.get(id);
    return this.workspacesService.getByDemandId(id);
  }

  /** spec User Story 5: powers the cockpit's workflow-progress view. */
  @Get(":id/workflow")
  workflow(@Param("id") id: string) {
    return this.workflowsService.getWorkflowView(id);
  }

  @Get(":id/specifications")
  async specifications(@Param("id") id: string) {
    await this.demandsService.get(id);
    return this.specificationsService.listForDemand(id);
  }

  @Get(":id/artifacts")
  async artifacts(@Param("id") id: string) {
    await this.demandsService.get(id);
    return this.artifactsService.listForDemand(id);
  }

  /**
   * spec FR-024: the full traceability chain — client, project, requirement,
   * specification (+ version), workspace, artifacts (+ repositories),
   * branch, files, tasks, responsible agent/LLM, commits, tests, pull
   * request, and the actor + timestamp of each step. A read-model that
   * joins existing resources, not a new stored entity.
   */
  @Get(":id/trace")
  async trace(@Param("id") id: string) {
    const demand = await this.demandsService.get(id);
    const [client, project, workspace, specifications, artifacts, branches, commits, pullRequests, timeline] =
      await Promise.all([
        this.prisma.db.client.findUnique({ where: { id: demand.clientId } }),
        this.prisma.db.project.findUnique({ where: { id: demand.projectId } }),
        this.workspacesService.getByDemandId(id),
        this.specificationsService.listForDemand(id),
        this.artifactsService.listForDemand(id),
        this.prisma.db.branch.findMany({ where: { demandId: id } }),
        this.prisma.db.commit.findMany({ where: { demandId: id } }),
        this.prisma.db.pullRequest.findMany({ where: { demandId: id } }),
        this.demandsService.timeline(id),
      ]);

    return {
      demand,
      client,
      project,
      workspace,
      specifications,
      artifacts,
      branches,
      commits,
      pull_requests: pullRequests,
      timeline,
    };
  }
}
