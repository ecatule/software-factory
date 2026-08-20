import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { ExecutionsService } from "./executions.service";
import { CreateExecutionDto } from "./dto/execution.dto";

@ApiTags("executions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("executions")
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  list(
    @Query("demand_id") demandId?: string,
    @Query("agent_id") agentId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    return this.executionsService.list(
      demandId,
      agentId,
      status,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post()
  @RequirePermission("AGENT_EXECUTE")
  create(@Body() dto: CreateExecutionDto) {
    return this.executionsService.create(dto);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.executionsService.get(id);
  }

  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return this.executionsService.retry(id);
  }

  /** feature 006 (pipeline configurável): retoma uma execução parada em AWAITING_MANUAL_STAGE. */
  @Post(":id/advance")
  @RequirePermission("AGENT_EXECUTE")
  advance(@Param("id") id: string) {
    return this.executionsService.advance(id);
  }

  /** feature 006 (pipeline configurável): histórico início/fim por etapa. */
  @Get(":id/stages")
  stages(@Param("id") id: string) {
    return this.executionsService.stages(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.executionsService.cancel(id);
  }
}
