import type { TestExecutorProvider } from "@software-factory/domain";
import type { PrismaService } from "../../common/prisma/prisma.service";
import { loadProjectHomologationEnvironment } from "../executions/project-environment-config";
import { EnvironmentGuard } from "./environment-guard.service";
import { QaExecutionService } from "./qa-execution.service";

jest.mock("../executions/project-environment-config");

const loadProjectHomologationEnvironmentMock = loadProjectHomologationEnvironment as jest.MockedFunction<
  typeof loadProjectHomologationEnvironment
>;

const TEST_CASE = {
  id: "test-case-1",
  demandId: "demand-1",
  type: "API",
  title: "Login com sucesso",
  preconditions: null,
  data: { method: "GET", path: "/ping" },
  steps: "1. GET /ping",
  expectedResult: "200",
};

/** spec User Story 3: EnvironmentGuard.validate SEMPRE é chamado, e precisa passar, antes de qualquer delegação ao TEST_EXECUTOR_PROVIDER. */
describe("QaExecutionService", () => {
  function build() {
    const auditLogCreate = jest.fn().mockResolvedValue(undefined);
    const functionalTestExecutionCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "execution-1", ...data }),
      );
    const functionalTestExecutionUpdate = jest
      .fn()
      .mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, ...data }),
      );
    const testEvidenceCreateMany = jest.fn().mockResolvedValue({ count: 0 });

    const prisma = {
      db: {
        demand: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "demand-1", projectId: "project-1" }),
        },
        testCase: { findMany: jest.fn().mockResolvedValue([TEST_CASE]) },
        demandWorkspace: { findUnique: jest.fn().mockResolvedValue(null) },
        project: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "project-1", requiredTestSuites: [] }),
        },
        functionalTestExecution: {
          create: functionalTestExecutionCreate,
          update: functionalTestExecutionUpdate,
        },
        testEvidence: { create: jest.fn(), createMany: testEvidenceCreateMany },
        auditLog: { create: auditLogCreate },
      },
    } as unknown as PrismaService;

    const environmentGuard = new EnvironmentGuard(prisma);
    const testExecutorProvider: TestExecutorProvider = {
      supports: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue({ status: "PASS", evidences: [] }),
    };

    const service = new QaExecutionService(prisma, environmentGuard, testExecutorProvider);
    return { service, testExecutorProvider, functionalTestExecutionUpdate, auditLogCreate };
  }

  it("calls the executor and records PASS when the environment is authorized", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue({ applicationUrl: "https://stage.example.com" });
    const { service, testExecutorProvider, functionalTestExecutionUpdate } = build();

    const results = await service.runFunctionalTests("demand-1");

    expect(testExecutorProvider.execute).toHaveBeenCalledTimes(1);
    expect(functionalTestExecutionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PASS" }) }),
    );
    expect(results).toHaveLength(1);
  });

  it("never calls the executor when the Environment Guard blocks — records BLOCKED instead (spec FR-012/FR-013)", async () => {
    loadProjectHomologationEnvironmentMock.mockResolvedValue(undefined);
    const { service, testExecutorProvider, functionalTestExecutionUpdate, auditLogCreate } = build();

    const results = await service.runFunctionalTests("demand-1");

    expect(testExecutorProvider.execute).not.toHaveBeenCalled();
    expect(functionalTestExecutionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED" }) }),
    );
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "QA_FUNCTIONAL_EXECUTION_BLOCKED" }),
    });
    expect(results).toHaveLength(1);
  });
});
