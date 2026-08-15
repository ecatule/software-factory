import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { PrismaService } from "../../common/prisma/prisma.service";
import { DemandsService } from "./demands.service";
import { CreateDemandDto, ImportDemandDto, UpdateDemandDto } from "./dto/demand.dto";
import { CreateIncrementDto } from "../increments/dto/increment.dto";
import {
  GeneratePromptSpecDto,
  SetDemandSystemArtifactsDto,
  SetDemandSystemsDto,
} from "./dto/demand-system.dto";
import { PromptSpecService } from "./prompt-spec.service";

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
    private readonly prisma: PrismaService,
    private readonly promptSpecService: PromptSpecService,
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
   * increment (409 if the current one isn't approved yet — FR-018).
   *
   * follow-up: used to also auto-enqueue a `specification_copilot` AI round
   * right here, seeded with the previous increment's approved
   * specify.md/plan.md. Removed — since "Enviar para IA" was disabled on the
   * Especificação Assistida screen (the Software Factory no longer makes
   * direct LLM calls from this flow), that auto-round never received
   * anything the analyst typed in the Wizard afterward (its `input` was
   * always `{}`), so it silently regenerated a version from STALE content —
   * live-observed to look like "the new increment kept the previous
   * increment's data" even after the analyst entered new information. The
   * real path for new Wizard input to become a Spec is manual: "Gerar
   * Prompt SPEC" → paste into an external AI → "Anexar arquivos prontos" —
   * which already correctly tags the uploaded version to the current
   * increment (`SpecificationsService.createVersion`).
   */
  @Post(":id/increments")
  @HttpCode(202)
  @RequirePermission("DEMAND_WRITE")
  async createIncrement(@Param("id") id: string, @Body() dto: CreateIncrementDto) {
    await this.demandsService.get(id);
    return this.incrementsService.createNext(id, dto.reason, dto.title);
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

  /** feature 005 (contracts/demand-spec-selection.md). */
  @Get(":id/systems")
  getSystems(@Param("id") id: string) {
    return this.demandsService.getAvailableAndSelectedSystems(id);
  }

  @Put(":id/systems")
  @RequirePermission("DEMAND_SYSTEM_WRITE")
  setSystems(@Param("id") id: string, @Body() dto: SetDemandSystemsDto) {
    return this.demandsService.setSelectedSystems(id, dto.systemIds);
  }

  @Get(":id/system-artifacts")
  getSystemArtifacts(
    @Param("id") id: string,
    @Query("search") search?: string,
    @Query("systemIds") systemIds?: string,
  ) {
    const parsedSystemIds = systemIds ? systemIds.split(",").filter(Boolean) : undefined;
    return this.demandsService.getAvailableAndSelectedSystemArtifacts(id, search, parsedSystemIds);
  }

  @Put(":id/system-artifacts")
  @RequirePermission("DEMAND_SYSTEM_WRITE")
  setSystemArtifacts(@Param("id") id: string, @Body() dto: SetDemandSystemArtifactsDto) {
    return this.demandsService.setSelectedSystemArtifacts(id, dto.systemArtifactIds);
  }

  /** feature 005 (contracts/prompt-generation.md): pure string building, zero LLM calls. */
  @Post(":id/prompt-spec")
  @RequirePermission("SPEC_PROMPT_GENERATE")
  generatePromptSpec(@Param("id") id: string, @Body() dto: GeneratePromptSpecDto) {
    return this.promptSpecService.generate(id, dto.business, dto.technical);
  }
}
