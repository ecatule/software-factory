import { Inject, Injectable } from "@nestjs/common";
import { TEST_EXECUTOR_PROVIDER, type TestExecutorProvider } from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";
import { loadProjectHomologationEnvironment } from "../executions/project-environment-config";
import { EnvironmentGuard } from "./environment-guard.service";

/**
 * spec User Story 3 (FR-010/FR-011): dispara a execução funcional dos
 * Casos de Teste de uma demanda contra o ambiente real de homologação.
 * `EnvironmentGuard.validate` é chamado ANTES de qualquer delegação ao
 * `TEST_EXECUTOR_PROVIDER`, para CADA execução — nenhuma chamada real
 * acontece sem essa verificação técnica ter passado primeiro.
 */
@Injectable()
export class QaExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly environmentGuard: EnvironmentGuard,
    @Inject(TEST_EXECUTOR_PROVIDER) private readonly testExecutorProvider: TestExecutorProvider,
  ) {}

  async runFunctionalTests(demandId: string, testCaseIds?: string[]) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });

    const testCases = await this.prisma.db.testCase.findMany({
      where: {
        demandId,
        automatable: true,
        ...(testCaseIds && testCaseIds.length > 0 ? { id: { in: testCaseIds } } : {}),
      },
    });

    const environment = await loadProjectHomologationEnvironment(demand.projectId);
    const targetUrl = environment?.applicationUrl ?? environment?.apiUrl ?? "";

    const workspace = await this.prisma.db.demandWorkspace.findUnique({ where: { demandId } });
    let requiredTestSuites: string[] | undefined;

    const results = [];
    for (const testCase of testCases) {
      const execution = await this.prisma.db.functionalTestExecution.create({
        data: {
          testCaseId: testCase.id,
          demandId,
          environment: "homologacao",
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      try {
        // spec FR-012/FR-013: verificação técnica ANTES de qualquer chamada
        // real — para CADA Caso de Teste, não só uma vez por lote.
        await this.environmentGuard.validate(demand.projectId, targetUrl);
      } catch (error) {
        results.push(
          await this.prisma.db.functionalTestExecution.update({
            where: { id: execution.id },
            data: {
              status: "BLOCKED",
              finishedAt: new Date(),
              error: error instanceof Error ? error.message : String(error),
            },
          }),
        );
        continue;
      }

      if (testCase.type === "UNIT" && requiredTestSuites === undefined) {
        const project = await this.prisma.db.project.findUniqueOrThrow({ where: { id: demand.projectId } });
        requiredTestSuites = project.requiredTestSuites;
      }

      const output = await this.testExecutorProvider.execute({
        testCase: {
          id: testCase.id,
          type: testCase.type,
          title: testCase.title,
          preconditions: testCase.preconditions,
          data: testCase.data,
          steps: testCase.steps,
          expectedResult: testCase.expectedResult,
        },
        environment: { applicationUrl: environment?.applicationUrl, apiUrl: environment?.apiUrl },
        workspacePath: workspace?.path,
        commands: testCase.type === "UNIT" ? requiredTestSuites : undefined,
      });

      const finished = await this.prisma.db.functionalTestExecution.update({
        where: { id: execution.id },
        data: { status: output.status, finishedAt: new Date(), error: output.error },
      });

      if (output.evidences.length > 0) {
        await this.prisma.db.testEvidence.createMany({
          data: output.evidences.map((evidence) => ({
            functionalTestExecutionId: finished.id,
            type: evidence.type,
            storageRef: evidence.storageRef,
            content: evidence.content,
          })),
        });
      }

      results.push(finished);
    }

    return results;
  }
}
