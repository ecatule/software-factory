export interface TestExecutionInput {
  testCase: {
    id: string;
    type: string;
    title: string;
    preconditions?: string | null;
    data?: unknown;
    steps: string;
    expectedResult: string;
  };
  environment: {
    applicationUrl?: string;
    apiUrl?: string;
  };
  /** cwd for executors that shell out (UnitTestExecutorProvider) — the demand's cloned repository. */
  workspacePath?: string;
  /**
   * `UnitTestExecutorProvider` only — resolved by `QaExecutionService` from
   * `Project.requiredTestSuites` before calling the provider (Provider
   * Abstraction: packages/infrastructure has no Prisma/DB access of its own,
   * only apps/api does). A known simplification: this runs the PROJECT's
   * whole configured suite as a stand-in signal for this specific unit
   * TestCase, since nothing links a generated TestCase to one exact test
   * file/function yet.
   */
  commands?: string[];
}

export interface TestEvidenceOutput {
  type: string;
  storageRef?: string;
  content?: string;
}

export interface TestExecutionOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  error?: string;
  evidences: TestEvidenceOutput[];
}

/**
 * spec FR-006/FR-011 (User Story 3): Casos de Teste são independentes de
 * tecnologia de execução — cada implementação concreta (API/UI/unitário)
 * fica atrás desta MESMA interface (Provider Abstraction), nunca acoplada
 * diretamente a `QaExecutionService`. `TEST_EXECUTOR_PROVIDER` resolve para
 * um único provider composto que delega por `TestCase.type` via `supports`
 * (ver providers.module.ts) — o mesmo padrão de token único já usado por
 * `CODE_REPOSITORY_PROVIDER`/`SDD_PROVIDER`.
 */
export interface TestExecutorProvider {
  supports(testCaseType: string): boolean;
  execute(input: TestExecutionInput): Promise<TestExecutionOutput>;
}

export const TEST_EXECUTOR_PROVIDER = Symbol("TEST_EXECUTOR_PROVIDER");
