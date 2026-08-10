import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { DemandType } from "@prisma/client";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { WorkflowsService } from "../workflows/workflows.service";
import { SpecificationsService } from "../specifications/specifications.service";
import { SpecificationContextService } from "../specifications/specification-context.service";
import { ArtifactsService } from "../artifacts/artifacts.service";
import { IncrementsService } from "../increments/increments.service";
import { ExecutionsService } from "../executions/executions.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DemandsService } from "./demands.service";
import { CreateDemandDto, ImportDemandDto, UpdateDemandDto } from "./dto/demand.dto";
import { CreateIncrementDto } from "../increments/dto/increment.dto";

/** feature 004 FR-006: DEMAND_READ is the class-level default; write endpoints override it below. */
@ApiTags("demands")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequirePermission("DEMAND_READ")
@Controller("demands")
export class DemandsController {
  constructor(
    private readonly demandsService: DemandsService,
    private readonly workspacesService: WorkspacesService,
    private readonly workflowsService: WorkflowsService,
    private readonly specificationsService: SpecificationsService,
    private readonly specificationContextService: SpecificationContextService,
    private readonly artifactsService: ArtifactsService,
    private readonly incrementsService: IncrementsService,
    private readonly executionsService: ExecutionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(
    @Query("client_id") clientId?: string,
    @Query("project_id") projectId?: string,
    @Query("status") status?: string,
    @Query("status_in") statusIn?: string,
    @Query("type") type?: DemandType,
    @Query("agent_id") agentId?: string,
    @Query("agent_status") agentStatus?: string,
    @Query("pr_status") prStatus?: string,
    @Query("has_failing_tests") hasFailingTests?: string,
    @Query("created_after") createdAfter?: string,
    @Query("created_before") createdBefore?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.demandsService.list({
      clientId,
      projectId,
      status,
      statusIn: statusIn ? statusIn.split(",") : undefined,
      type,
      agentId,
      agentStatus,
      prStatus,
      hasFailingTests: hasFailingTests === "true",
      createdAfter: createdAfter ? new Date(createdAfter) : undefined,
      createdBefore: createdBefore ? new Date(createdBefore) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post()
  @RequirePermission("DEMAND_WRITE")
  create(@Body() dto: CreateDemandDto) {
    return this.demandsService.create(dto);
  }

  /** feature 004 FR-015/FR-016 (contracts/dashboard-demands.md): reuses the existing DemandProvider, never calls Monday directly. */
  @Post("import")
  @RequirePermission("DEMAND_WRITE")
  importDemand(@Body() dto: ImportDemandDto) {
    return this.demandsService.importFromProvider(dto.externalId, dto.clientId, dto.projectId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.demandsService.get(id);
  }

  @Patch(":id")
  @RequirePermission("DEMAND_WRITE")
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

  /** feature 004 FR-003: the "Branch de Origem" auto-fill for the Especificação Assistida screen. */
  @Get(":id/origin-branch")
  async originBranch(@Param("id") id: string) {
    return this.specificationContextService.resolveOriginBranch(id);
  }

  /**
   * feature 003 (live-validation finding, User Story 1 Acceptance Scenario
   * 1): lazily creates the Specification container the first time the
   * analyst opens the Especificação Assistida screen for a demand that has
   * never been specified before, so there is always a `specificationId` to
   * navigate to.
   */
  @Post(":id/specifications/:documentType/ensure")
  async ensureSpecification(
    @Param("id") id: string,
    @Param("documentType") documentType: "SPEC" | "PLAN",
  ) {
    await this.demandsService.get(id);
    return this.specificationsService.ensureForDemand(id, documentType);
  }

  @Get(":id/artifacts")
  async artifacts(@Param("id") id: string) {
    await this.demandsService.get(id);
    return this.artifactsService.listForDemand(id);
  }

  /** feature 003 FR-017/FR-021 (User Story 3): each increment's own specification evolution. */
  @Get(":id/increments")
  async listIncrements(@Param("id") id: string) {
    await this.demandsService.get(id);
    return this.incrementsService.list(id);
  }

  /**
   * feature 003 FR-017–FR-019 (contracts/increments.md): creates the next
   * increment (409 if the current one isn't approved yet — FR-018) and
   * immediately enqueues its first AI round, seeded with the previous
   * increment's approved specify.md/plan.md by SpecificationContextService.
   * 202 because the increment itself is created synchronously but the round
   * it kicks off is asynchronous (Clarifications 2026-08-09).
   */
  @Post(":id/increments")
  @HttpCode(202)
  @RequirePermission("DEMAND_WRITE")
  async createIncrement(@Param("id") id: string, @Body() dto: CreateIncrementDto) {
    await this.demandsService.get(id);
    const increment = await this.incrementsService.createNext(id, dto.reason, dto.title);

    const copilotAgent = await this.prisma.db.agent.findFirst({
      where: { type: "specification_copilot" },
    });
    if (copilotAgent) {
      await this.executionsService.create({ agentId: copilotAgent.id, demandId: id });
    }

    return increment;
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
