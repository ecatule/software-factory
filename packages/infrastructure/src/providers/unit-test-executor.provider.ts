import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { TestExecutionInput, TestExecutionOutput, TestExecutorProvider } from "@software-factory/domain";

const execAsync = promisify(exec);

/**
 * spec FR-007 (User Story 3): executor para `TestCase.type === "UNIT"`.
 * Known simplification (documented on `TestExecutionInput.commands`):
 * reaproveita o mesmo mecanismo já usado por `TestRunnerService`
 * (`Project.requiredTestSuites`) — roda a suíte de testes já configurada
 * para o Projeto como sinal representativo, já que nada liga hoje um
 * `TestCase` gerado a um arquivo/função de teste específico.
 */
export class UnitTestExecutorProvider implements TestExecutorProvider {
  supports(testCaseType: string): boolean {
    return testCaseType === "UNIT";
  }

  async execute(input: TestExecutionInput): Promise<TestExecutionOutput> {
    const { workspacePath, commands } = input;

    if (!workspacePath) {
      return { status: "BLOCKED", error: "No workspacePath provided to run the test suite in", evidences: [] };
    }
    if (!commands || commands.length === 0) {
      return {
        status: "BLOCKED",
        error: "Project has no requiredTestSuites configured — nothing to run for this unit test case",
        evidences: [],
      };
    }

    const logs: string[] = [];
    let failed = false;
    for (const command of commands) {
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: workspacePath });
        logs.push(`$ ${command}\n${stdout}${stderr ? `\n${stderr}` : ""}`);
      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : String(error);
        logs.push(`$ ${command}\n${message}`);
      }
    }

    return {
      status: failed ? "FAIL" : "PASS",
      error: failed ? "One or more required test suites failed — see evidence logs" : undefined,
      evidences: [{ type: "logs", content: logs.join("\n\n") }],
    };
  }
}
