import { Body, Controller, Get, Param, Post, UnprocessableEntityException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WorkflowsService } from "../workflows/workflows.service";
import { RunFunctionalTestsDto } from "./dto/qa.dto";
import { QaExecutionService } from "./qa-execution.service";

/** feature 006 (contracts/qa-test-cases.md, contracts/qa-functional-testing.md). */
@ApiTags("qa")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("demands/:demandId/qa")
export class QaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowsService,
    private readonly qaExecutionService: QaExecutionService,
  ) {}

  /**
   * spec User Story 1: a geração em si não tem endpoint próprio — acontece
   * automaticamente dentro do ExecutionsProcessor (QaGenerationService).
   * Este endpoint só lê o que já foi gerado.
   */
  @Get("test-cases")
  @RequirePermission("QA_READ")
  listTestCases(@Param("demandId") demandId: string) {
    return this.prisma.db.testCase.findMany({
      where: { demandId },
      orderBy: { createdAt: "asc" },
    });
  }

  /** spec User Story 3 (FR-010): dispara a execução funcional real, protegida pelo EnvironmentGuard (US2). */
  @Post("functional-tests/run")
  @RequirePermission("QA_EXECUTE")
  async runFunctionalTests(@Param("demandId") demandId: string, @Body() dto: RunFunctionalTestsDto) {
    const ready = await this.workflows.isAtOrAfterStage(demandId, "READY_FOR_FUNCTIONAL_TEST");
    if (!ready) {
      throw new UnprocessableEntityException(
        "Demand is not in READY_FOR_FUNCTIONAL_TEST or a later stage yet",
      );
    }
    return this.qaExecutionService.runFunctionalTests(demandId, dto.testCaseIds);
  }

  /** spec User Story 4 (FR-014): histórico de execuções + evidências. */
  @Get("functional-tests")
  @RequirePermission("QA_READ")
  async listFunctionalTests(@Param("demandId") demandId: string) {
    const executions = await this.prisma.db.functionalTestExecution.findMany({
      where: { demandId },
      orderBy: { startedAt: "desc" },
    });
    const evidences = await this.prisma.db.testEvidence.findMany({
      where: { functionalTestExecutionId: { in: executions.map((e) => e.id) } },
    });
    const evidencesByExecution = new Map<string, typeof evidences>();
    for (const evidence of evidences) {
      const list = evidencesByExecution.get(evidence.functionalTestExecutionId) ?? [];
      list.push(evidence);
      evidencesByExecution.set(evidence.functionalTestExecutionId, list);
    }

    return executions.map((execution) => ({
      ...execution,
      evidences: evidencesByExecution.get(execution.id) ?? [],
    }));
  }
}
