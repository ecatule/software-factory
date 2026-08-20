import type { TestExecutionInput, TestExecutionOutput, TestExecutorProvider } from "@software-factory/domain";

/**
 * spec User Story 3 (research.md/tasks.md T027): `TEST_EXECUTOR_PROVIDER`
 * resolves to a SINGLE token (same pattern as every other Provider in this
 * codebase) that delegates to the right concrete executor by
 * `TestCase.type` — `QaExecutionService` only ever depends on the
 * interface, never on `ApiTestExecutorProvider`/`BrowserTestExecutorProvider`/
 * `UnitTestExecutorProvider` directly.
 */
export class CompositeTestExecutorProvider implements TestExecutorProvider {
  constructor(private readonly delegates: TestExecutorProvider[]) {}

  supports(testCaseType: string): boolean {
    return this.delegates.some((delegate) => delegate.supports(testCaseType));
  }

  async execute(input: TestExecutionInput): Promise<TestExecutionOutput> {
    const delegate = this.delegates.find((candidate) => candidate.supports(input.testCase.type));
    if (!delegate) {
      return {
        status: "BLOCKED",
        error: `No test executor registered for TestCase.type "${input.testCase.type}"`,
        evidences: [],
      };
    }
    return delegate.execute(input);
  }
}
