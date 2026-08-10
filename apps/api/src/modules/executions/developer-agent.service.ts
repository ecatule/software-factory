import { Inject, Injectable } from "@nestjs/common";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  CODE_REPOSITORY_PROVIDER,
  type CodeRepositoryProvider,
} from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * spec User Story 6: the Developer Agent's supporting logic — branch
 * creation and file-change bookkeeping — kept separate from
 * ExecutionsProcessor so both the worker and the explicit
 * `POST /demands/:id/branch` endpoint (US8, T073) call the SAME code path
 * rather than each re-implementing "one branch per repository per demand".
 */
@Injectable()
export class DeveloperAgentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CODE_REPOSITORY_PROVIDER)
    private readonly codeRepositoryProvider: CodeRepositoryProvider,
  ) {}

  /**
   * spec Edge Cases: when multiple artifacts share a repository, only ONE
   * branch is created for that repository for this demand — enforced via
   * `Branch`'s `(repositoryId, demandId)` unique constraint plus this
   * find-or-create logic, never a blind create.
   */
  async ensureBranchesForDemand(demandId: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { repositories: true },
    });
    const repositoryIds = [
      ...new Set(artifacts.flatMap((a) => a.repositories.map((r) => r.repositoryId))),
    ];

    const project = await this.prisma.db.project.findUniqueOrThrow({
      where: { id: demand.projectId },
    });

    const branches = [];
    for (const repositoryId of repositoryIds) {
      const existing = await this.prisma.db.branch.findUnique({
        where: { repositoryId_demandId: { repositoryId, demandId } },
      });
      if (existing) {
        branches.push(existing);
        continue;
      }

      const repository = await this.prisma.db.repository.findUniqueOrThrow({
        where: { id: repositoryId },
      });
      const branchName = this.buildBranchName(project.branchNamingPolicy, demand);
      await this.codeRepositoryProvider.createBranch(repository.externalReference, branchName);
      branches.push(
        await this.prisma.db.branch.create({ data: { repositoryId, demandId, name: branchName } }),
      );
    }
    return branches;
  }

  /**
   * "Modo B" (headless Claude Code): `implement` needs a real local clone to
   * edit, and `CodeRepositoryProvider.cloneRepository()` existed since 001
   * but nothing ever called it. Call AFTER `ensureBranchesForDemand()` so
   * the demand's branch already exists to check out. Idempotent — skips
   * repositories already cloned into `artefatos/<repo>/`.
   */
  async ensureRepositoriesCloned(demandId: string, workspacePath: string): Promise<void> {
    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { repositories: true },
    });
    const repositoryIds = [
      ...new Set(artifacts.flatMap((a) => a.repositories.map((r) => r.repositoryId))),
    ];
    if (repositoryIds.length === 0) return;

    const branches = await this.prisma.db.branch.findMany({
      where: { demandId, repositoryId: { in: repositoryIds } },
    });
    const branchNameByRepo = new Map(branches.map((b) => [b.repositoryId, b.name]));

    for (const repositoryId of repositoryIds) {
      const repository = await this.prisma.db.repository.findUniqueOrThrow({
        where: { id: repositoryId },
      });
      const repoDirName = repository.externalReference.split("/").pop() ?? repository.externalReference;
      const targetPath = path.join(workspacePath, "artefatos", repoDirName);

      if (!(await this.pathExists(path.join(targetPath, ".git")))) {
        await this.codeRepositoryProvider.cloneRepository(repository.externalReference, targetPath);
      }

      const branchName = branchNameByRepo.get(repositoryId);
      if (branchName) {
        await this.codeRepositoryProvider.checkoutBranch(targetPath, branchName);
      }
    }
  }

  private async pathExists(candidate: string): Promise<boolean> {
    try {
      await access(candidate);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * spec FR-017: files outside the originally planned scope are recorded as
   * DISCOVERED with a justification — never silently added as MODIFIED.
   */
  async recordImplementationFiles(demandId: string, artifactId: string, filesChanged: string[]) {
    const plannedFiles = new Set(
      (
        await this.prisma.db.artifactFile.findMany({
          where: { artifactId, changeType: { not: "DISCOVERED" } },
        })
      ).map((f) => f.filePath),
    );

    return Promise.all(
      filesChanged.map((filePath) =>
        this.prisma.db.artifactFile.create({
          data: {
            artifactId,
            filePath,
            changeType: plannedFiles.has(filePath) ? "MODIFIED" : "DISCOVERED",
            reason: plannedFiles.has(filePath)
              ? undefined
              : "Discovered during automated implementation, outside the originally planned file list",
          },
        }),
      ),
    );
  }

  private buildBranchName(policy: string, demand: { type: string; externalId: string }): string {
    const slug = demand.externalId.toLowerCase();
    return policy
      .replace("<type>", demand.type.toLowerCase())
      .replace("<client>", "client")
      .replace("<ticket>-<slug>", slug);
  }
}
