import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const execAsync = promisify(exec);

/** Very small heuristic parser for common `npm test`-style summary lines. */
function parseTestSummary(output: string): { passed: number; failed: number; skipped: number } {
  const passed = Number(/(\d+)\s+passed/i.exec(output)?.[1] ?? 0);
  const failed = Number(/(\d+)\s+failed/i.exec(output)?.[1] ?? 0);
  const skipped = Number(/(\d+)\s+skipped/i.exec(output)?.[1] ?? 0);
  return { passed, failed, skipped };
}

/**
 * spec FR-020: runs a project's configured required test suites (e.g.
 * `npm test`, `npm run lint`, `npm run build`) and records the outcome.
 * Command failures (non-zero exit) count as a failed suite even when the
 * summary can't be parsed.
 */
@Injectable()
export class TestRunnerService {
  constructor(private readonly prisma: PrismaService) {}

  async runRequiredSuites(demandId: string) {
    const demand = await this.prisma.db.demand.findUnique({ where: { id: demandId } });
    if (!demand) throw new NotFoundException(`Demand ${demandId} not found`);

    const project = await this.prisma.db.project.findUniqueOrThrow({
      where: { id: demand.projectId },
    });
    const workspace = await this.prisma.db.demandWorkspace.findUnique({ where: { demandId } });
    const cwd = workspace?.path ?? path.join("workspace", demandId);

    const executions = [];
    for (const suite of project.requiredTestSuites) {
      executions.push(await this.runSuite(demandId, project.id, suite, cwd));
    }
    return executions;
  }

  private async runSuite(demandId: string, projectId: string, command: string, cwd: string) {
    const startedAt = new Date();
    const execution = await this.prisma.db.testExecution.create({
      data: { demandId, projectId, suite: command, command, status: "RUNNING", startedAt },
    });

    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      const summary = parseTestSummary(stdout);
      const finishedAt = new Date();

      const updated = await this.prisma.db.testExecution.update({
        where: { id: execution.id },
        data: {
          status: summary.failed > 0 ? "FAILED" : "PASSED",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          output: stdout,
          error: stderr || null,
        },
      });
      await this.prisma.db.testResult.create({
        data: {
          testExecutionId: execution.id,
          passedCount: summary.passed,
          failedCount: summary.failed,
          skippedCount: summary.skipped,
        },
      });
      return updated;
    } catch (error) {
      const finishedAt = new Date();
      return this.prisma.db.testExecution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
