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
   * required test suite's most recent run is not PASSED. Returns the
   * project so callers that also need it (`commit()`) don't re-fetch it.
   */
  async assertTestGatePassed(demandId: string) {
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
    return project;
  }

  /**
   * spec User Story 8 / FR-022: after the Test Gate passes, commit and push,
   * linking the commit to the demand, its artifact, and the test execution
   * that authorized it. Re-uses the same branch T061/T073 created — never a
   * second, independent branch-creation path (spec Edge Cases).
   *
   * `filePaths` (optional): stages only these paths instead of every dirty
   * file — used by the Developer Agent's automated post-implement commit so
   * unrelated pre-existing working-tree changes never get swept in.
   * `agentExecutionId` (optional): links the Commit back to the
   * AgentExecution that produced it, when called from that automated path.
   */
  async commit(
    demandId: string,
    artifactId: string,
    message: string,
    filePaths?: string[],
    agentExecutionId?: string,
  ) {
    const project = await this.assertTestGatePassed(demandId);

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
    // follow-up: only REQUIRED when the project actually has required test
    // suites (the Test Gate above already enforces those passed) — the
    // Developer Agent's pipeline doesn't run a test stage yet, so demanding
    // a TestExecution row unconditionally would make auto-commit impossible
    // for every project that (like most today) has none configured.
    const latestTest =
      project.requiredTestSuites.length > 0
        ? await this.prisma.db.testExecution.findFirstOrThrow({
            where: { demandId },
            orderBy: { startedAt: "desc" },
          })
        : await this.prisma.db.testExecution.findFirst({
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
      filePaths,
    );
    await this.codeRepositoryProvider.push(externalReference, targetPath, branch.name);

    return this.prisma.db.commit.create({
      data: {
        branchId: branch.id,
        sha: commitRef.sha,
        demandId,
        artifactId,
        testExecutionId: latestTest?.id,
        agentExecutionId,
      },
    });
  }

  /**
   * spec FR-023: content derived server-side, never left for a human to
   * fill in — demand summary, affected artifacts, changed files, test
   * results, and risks (risks default to "none identified" until a risk
   * assessment mechanism exists).
   *
   * follow-up: a demand can span several repositories (one per artifact
   * actually touched) — creating a PR for only the first eligible artifact
   * silently missed every other repo with real changes (live-observed: the
   * PR landed on an untouched artifact while the two repos with the actual
   * commits got no PR at all). Now creates one PR per eligible artifact,
   * skipping ones that already have a PR for this demand and capturing
   * per-artifact failures (e.g. GitHub's "no commits between" error when an
   * artifact's branch has nothing to compare) instead of aborting the rest —
   * same convention as `commitAllArtifacts`.
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

    const branches = await this.prisma.db.branch.findMany({ where: { demandId } });
    const branchByArtifactId = new Map(branches.map((b) => [b.artifactId, b]));
    const existingPRs = await this.prisma.db.pullRequest.findMany({ where: { demandId } });
    const artifactIdsWithPR = new Set(existingPRs.map((p) => p.artifactId).filter((id): id is string => !!id));

    const eligibleArtifacts = artifacts.filter(
      (a) => a.repositories.length > 0 && branchByArtifactId.has(a.id),
    );
    if (eligibleArtifacts.length === 0) {
      throw new HttpException("No repository linked to this demand's artifacts", HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const title = `[${demand.externalId}] ${demand.title}`;
    const description = this.buildPullRequestDescription(demand, artifacts, tests);

    const results: Array<
      | { artifactId: string; pullRequestId: string; externalReference: string }
      | { artifactId: string; error: string }
      | { artifactId: string; skipped: true }
    > = [];
    for (const artifact of eligibleArtifacts) {
      if (artifactIdsWithPR.has(artifact.id)) {
        results.push({ artifactId: artifact.id, skipped: true });
        continue;
      }
      const branch = branchByArtifactId.get(artifact.id)!;
      const repository = await this.prisma.db.repository.findUniqueOrThrow({
        where: { id: branch.repositoryId },
      });
      const externalReference = composeOwnerRepo(repository.externalReference, artifact.name);
      try {
        // spec 004 FR-002: a PR must always target the repository's
        // homologation branch, never production — codeRepositoryProvider
        // falls back to the repo's own default branch only when
        // homologationBranch isn't configured.
        const pr = await this.codeRepositoryProvider.createPullRequest(
          externalReference,
          branch.name,
          title,
          description,
          repository.homologationBranch ?? undefined,
        );
        const created = await this.prisma.db.pullRequest.create({
          data: {
            repositoryId: repository.id,
            demandId,
            artifactId: artifact.id,
            externalReference: pr.externalReference,
            title,
            description,
            status: pr.status,
            url: pr.url,
          },
        });
        results.push({ artifactId: artifact.id, pullRequestId: created.id, externalReference: created.externalReference });
      } catch (error) {
        results.push({
          artifactId: artifact.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  /** spec User Story 6/8: single shared branch-creation path (see developer-agent.service.ts). */
  createBranch(demandId: string) {
    return this.developerAgent.ensureBranchesForDemand(demandId);
  }

  /**
   * Manual "Sincronizar" trigger (Atividade do Git screen) — re-fetches a
   * PR's live status/URL from GitHub and updates the stored row. Covers two
   * cases: (1) rows created before the `url` column existed, or before
   * `createPullRequest` started saving it, still have `url: null`; (2) a PR
   * merged/closed on GitHub after we created it — our own status field never
   * updates on its own, there's no webhook wiring.
   */
  async syncPullRequest(pullRequestId: string) {
    const pullRequest = await this.prisma.db.pullRequest.findUniqueOrThrow({
      where: { id: pullRequestId },
    });
    if (!pullRequest.artifactId) {
      throw new HttpException(
        "Pull Request has no linked artifact — cannot resolve which repository to sync from",
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const [repository, artifact] = await Promise.all([
      this.prisma.db.repository.findUniqueOrThrow({ where: { id: pullRequest.repositoryId } }),
      this.prisma.db.artifact.findUniqueOrThrow({ where: { id: pullRequest.artifactId } }),
    ]);
    const externalReference = composeOwnerRepo(repository.externalReference, artifact.name);
    const pr = await this.codeRepositoryProvider.getPullRequest(
      externalReference,
      pullRequest.externalReference,
    );
    return this.prisma.db.pullRequest.update({
      where: { id: pullRequestId },
      data: { status: pr.status, url: pr.url },
    });
  }

  /**
   * Manual "commit + push everything pending" trigger (Agentes screen) for
   * when the automated pipeline stalled before reaching its own commit
   * stage. Unlike that stage — which only sweeps files that became dirty
   * DURING one execution (diff against a "before" snapshot, see
   * executions.processor.ts) — this sweeps whatever is CURRENTLY dirty in
   * each artifact's repo, since the whole point is to unstick a demand with
   * leftover uncommitted work. Per-artifact failures are captured instead of
   * aborting the rest, same convention as that automated stage.
   */
  async commitAllArtifacts(demandId: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { repositories: true },
    });
    const workspacePath = await this.developerAgent.resolveWorkspacePath(demandId);
    const message = `feat[${demand.externalId}] ${demand.title.trim()}\n\nCommit manual via tela Agentes.`;

    const results: Array<
      { artifactId: string; sha: string } | { artifactId: string; error: string } | { artifactId: string; skipped: true }
    > = [];
    for (const artifact of artifacts) {
      const [firstRepoLink] = artifact.repositories;
      if (!firstRepoLink) {
        results.push({ artifactId: artifact.id, skipped: true });
        continue;
      }
      const branch = await this.prisma.db.branch.findUnique({
        where: { artifactId_demandId: { artifactId: artifact.id, demandId } },
      });
      if (!branch) {
        results.push({ artifactId: artifact.id, skipped: true });
        continue;
      }
      const repository = await this.prisma.db.repository.findUniqueOrThrow({
        where: { id: branch.repositoryId },
      });
      const externalReference = composeOwnerRepo(repository.externalReference, artifact.name);
      const targetPath = this.developerAgent.resolveClonePath(workspacePath, externalReference);
      const dirty = await this.developerAgent.snapshotDirtyFiles([targetPath]);
      const files = [...(dirty.get(targetPath) ?? [])];
      if (files.length === 0) {
        results.push({ artifactId: artifact.id, skipped: true });
        continue;
      }
      try {
        const commit = await this.commit(demandId, artifact.id, message, files);
        results.push({ artifactId: artifact.id, sha: commit.sha });
      } catch (error) {
        results.push({
          artifactId: artifact.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
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
