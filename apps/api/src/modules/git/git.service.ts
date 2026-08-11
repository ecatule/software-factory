import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CODE_REPOSITORY_PROVIDER,
  type CodeRepositoryProvider,
} from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DeveloperAgentService } from "../executions/developer-agent.service";
import { composeOwnerRepo } from "../executions/repository-reference";

@Injectable()
export class GitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly developerAgent: DeveloperAgentService,
    @Inject(CODE_REPOSITORY_PROVIDER)
    private readonly codeRepositoryProvider: CodeRepositoryProvider,
  ) {}

  /**
   * spec FR-021 (Test Gate): no commit may be created for a demand while any
   * required test suite's most recent run is not PASSED.
   */
  async assertTestGatePassed(demandId: string): Promise<void> {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const project = await this.prisma.db.project.findUniqueOrThrow({
      where: { id: demand.projectId },
    });

    const failingSuites: string[] = [];
    for (const suite of project.requiredTestSuites) {
      const latest = await this.prisma.db.testExecution.findFirst({
        where: { demandId, suite },
        orderBy: { startedAt: "desc" },
      });
      if (!latest || latest.status !== "PASSED") {
        failingSuites.push(suite);
      }
    }

    if (failingSuites.length > 0) {
      throw new HttpException(
        { message: "Test Gate failed — commit blocked", failingSuites },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * spec User Story 8 / FR-022: after the Test Gate passes, commit and push,
   * linking the commit to the demand, its artifact, and the test execution
   * that authorized it. Re-uses the same branch T061/T073 created — never a
   * second, independent branch-creation path (spec Edge Cases).
   */
  async commit(demandId: string, artifactId: string, message: string) {
    await this.assertTestGatePassed(demandId);

    const artifact = await this.prisma.db.artifact.findUnique({
      where: { id: artifactId },
      include: { repositories: true },
    });
    if (!artifact) throw new NotFoundException(`Artifact ${artifactId} not found`);
    const [firstRepoLink] = artifact.repositories;
    if (!firstRepoLink) {
      throw new HttpException(
        `Artifact ${artifactId} has no linked repository`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const branch = await this.prisma.db.branch.findUniqueOrThrow({
      where: {
        artifactId_demandId: { artifactId, demandId },
      },
    });
    const repository = await this.prisma.db.repository.findUniqueOrThrow({
      where: { id: branch.repositoryId },
    });
    const externalReference = composeOwnerRepo(repository.externalReference, artifact.name);
    const latestTest = await this.prisma.db.testExecution.findFirstOrThrow({
      where: { demandId },
      orderBy: { startedAt: "desc" },
    });

    const workspacePath = await this.developerAgent.resolveWorkspacePath(demandId);
    const targetPath = this.developerAgent.resolveClonePath(workspacePath, externalReference);

    const commitRef = await this.codeRepositoryProvider.commit(
      externalReference,
      targetPath,
      branch.name,
      message,
    );
    await this.codeRepositoryProvider.push(externalReference, targetPath, branch.name);

    return this.prisma.db.commit.create({
      data: {
        branchId: branch.id,
        sha: commitRef.sha,
        demandId,
        artifactId,
        testExecutionId: latestTest.id,
      },
    });
  }

  /**
   * spec FR-023: content derived server-side, never left for a human to
   * fill in — demand summary, affected artifacts, changed files, test
   * results, and risks (risks default to "none identified" until a risk
   * assessment mechanism exists).
   */
  async createPullRequest(demandId: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { files: true, repositories: true },
    });
    const tests = await this.prisma.db.testExecution.findMany({
      where: { demandId },
      include: { result: true },
    });

    const [firstArtifact] = artifacts;
    const [firstRepoLink] = firstArtifact?.repositories ?? [];
    if (!firstArtifact || !firstRepoLink) {
      throw new HttpException("No repository linked to this demand's artifacts", HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const branch = await this.prisma.db.branch.findUniqueOrThrow({
      where: { artifactId_demandId: { artifactId: firstArtifact.id, demandId } },
    });
    const repository = await this.prisma.db.repository.findUniqueOrThrow({
      where: { id: branch.repositoryId },
    });
    const externalReference = composeOwnerRepo(repository.externalReference, firstArtifact.name);

    const description = this.buildPullRequestDescription(demand, artifacts, tests);
    const pr = await this.codeRepositoryProvider.createPullRequest(
      externalReference,
      branch.name,
      `[${demand.externalId}] ${demand.title}`,
      description,
    );

    return this.prisma.db.pullRequest.create({
      data: {
        repositoryId: repository.id,
        demandId,
        externalReference: pr.externalReference,
        title: `[${demand.externalId}] ${demand.title}`,
        description,
        status: pr.status,
      },
    });
  }

  /** spec User Story 6/8: single shared branch-creation path (see developer-agent.service.ts). */
  createBranch(demandId: string) {
    return this.developerAgent.ensureBranchesForDemand(demandId);
  }

  private buildPullRequestDescription(
    demand: { externalId: string; title: string },
    artifacts: { name: string; files: { filePath: string }[] }[],
    tests: { suite: string; status: string; result: { passedCount: number; failedCount: number } | null }[],
  ): string {
    const artifactsList = artifacts.map((a) => `- ${a.name}`).join("\n") || "- (none)";
    const filesList =
      artifacts.flatMap((a) => a.files.map((f) => `- ${f.filePath}`)).join("\n") || "- (none)";
    const testsList =
      tests
        .map(
          (t) =>
            `- ${t.suite}: ${t.status}` +
            (t.result ? ` (${t.result.passedCount} passed, ${t.result.failedCount} failed)` : ""),
        )
        .join("\n") || "- (none)";

    return [
      `## Demanda\n\n${demand.externalId}`,
      `## Resumo\n\n${demand.title}`,
      `## Artefatos\n\n${artifactsList}`,
      `## Arquivos alterados\n\n${filesList}`,
      `## Testes\n\n${testsList}`,
      `## Riscos\n\nNenhum risco identificado.`,
    ].join("\n\n");
  }
}
