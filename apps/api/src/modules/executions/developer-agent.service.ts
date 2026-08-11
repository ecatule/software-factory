import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  CODE_REPOSITORY_PROVIDER,
  type CodeRepositoryProvider,
} from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WORKSPACE_ROOT } from "../workspaces/workspaces.service";
import { loadProjectSanitizationRules } from "./project-environment-config";
import { assertRepositoriesAreProductionSafe, sanitizeRepositories } from "./production-reference.guard";
import { composeOwnerRepo } from "./repository-reference";

interface ArtifactRepositoryLink {
  artifactId: string;
  repositoryId: string;
  /** Composed "owner/repo" — see repository-reference.ts. */
  externalReference: string;
}

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
   * follow-up: shared with `ExecutionsProcessor` (every execution needs
   * this, not just "developer" ones) and `GitService.commit()` (needs the
   * same clone location the Developer Agent used) — previously duplicated,
   * now the one place `DemandWorkspace` gets resolved.
   *
   * follow-up (live-validation finding): the fallback for demands that
   * never had `POST /demands/:id/workspace` called used to be the bare
   * relative path `"workspace/<demandId>"`, resolved against whatever
   * directory the API process happened to be launched from (e.g.
   * `apps/api/workspace/...` instead of the repo-root `workspace/...` every
   * other workspace lives in) — the exact "process cwd varies" trap
   * `WORKSPACE_ROOT` in workspaces.service.ts already exists to avoid.
   * Reusing that same constant keeps the fallback consistent with
   * `WorkspacesService.createForDemand()`.
   */
  async resolveWorkspacePath(demandId: string): Promise<string> {
    const workspace = await this.prisma.db.demandWorkspace.findUnique({ where: { demandId } });
    return workspace?.path ?? path.join(WORKSPACE_ROOT, demandId);
  }

  /**
   * follow-up: was "multiple artifacts share a repository → share ONE
   * branch", enforced via `Branch`'s `(repositoryId, demandId)` uniqueness.
   * Now that `Repository.externalReference` is just the shared org/host
   * base (composeOwnerRepo in repository-reference.ts), a single Repository
   * row can back several DIFFERENT real repos — one per Artifact — so
   * branch identity keys off `(artifactId, demandId)` instead. Still a
   * find-or-create, never a blind create.
   */
  async ensureBranchesForDemand(demandId: string) {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const links = await this.resolveArtifactRepositoryLinks(demandId);

    const project = await this.prisma.db.project.findUniqueOrThrow({
      where: { id: demand.projectId },
    });

    const branches = [];
    for (const link of links) {
      const existing = await this.prisma.db.branch.findUnique({
        where: { artifactId_demandId: { artifactId: link.artifactId, demandId } },
      });
      if (existing) {
        branches.push(existing);
        continue;
      }

      const branchName = this.buildBranchName(project.branchNamingPolicy, demand);
      await this.codeRepositoryProvider.createBranch(link.externalReference, branchName);
      branches.push(
        await this.prisma.db.branch.create({
          data: { repositoryId: link.repositoryId, artifactId: link.artifactId, demandId, name: branchName },
        }),
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
    const links = await this.resolveArtifactRepositoryLinks(demandId);
    if (links.length === 0) return;

    const branches = await this.prisma.db.branch.findMany({
      where: { demandId, artifactId: { in: links.map((l) => l.artifactId) } },
    });
    const branchNameByArtifact = new Map(branches.map((b) => [b.artifactId, b.name]));

    for (const link of links) {
      const targetPath = this.resolveClonePath(workspacePath, link.externalReference);

      if (!(await this.pathExists(path.join(targetPath, ".git")))) {
        await this.codeRepositoryProvider.cloneRepository(link.externalReference, targetPath);
      }

      const branchName = branchNameByArtifact.get(link.artifactId);
      if (branchName) {
        await this.codeRepositoryProvider.checkoutBranch(targetPath, branchName);
      }
    }
  }

  /**
   * follow-up (security): runs right after `ensureRepositoriesCloned` and
   * before the SDD provider's `implement` stage is ever invoked — the one
   * moment the cloned Artefato repositories exist on disk but the
   * Developer Agent hasn't touched them yet.
   *
   * Two layers: (1) rewrites KNOWN production patterns to a fixed
   * homologation value per the Project's rules (project-environment-config.ts
   * — a file on the API server's own filesystem, never Postgres, never a
   * literal production URL); (2) blocks the run if anything STILL looks
   * like production or a real secret afterward. Records an AuditLog entry
   * either way — for a sanitization, only the rule/file/variable touched,
   * deliberately never the value; for a block, the reason. Same pattern
   * `WorkflowsService.recordStageTransition` uses for writes that happen
   * inside this BullMQ worker instead of an HTTP request (the global
   * AuditInterceptor only wraps HTTP request/response cycles).
   */
  async enforceProductionSafety(demandId: string, workspacePath: string): Promise<void> {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const links = await this.resolveArtifactRepositoryLinks(demandId);
    if (links.length === 0) return;

    const repoPaths = links.map((link) => this.resolveClonePath(workspacePath, link.externalReference));
    const rules = await loadProjectSanitizationRules(demand.projectId);

    const changes = await sanitizeRepositories(repoPaths, rules);
    if (changes.length > 0) {
      await this.prisma.db.auditLog.create({
        data: {
          action: "PRE_IMPLEMENT_AUTO_SANITIZED",
          entityType: "demands",
          entityId: demandId,
          after: { changes },
          correlationId: randomUUID(),
        },
      });
    }

    try {
      await assertRepositoriesAreProductionSafe(repoPaths);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.db.auditLog.create({
        data: {
          action: "PRE_IMPLEMENT_SAFETY_BLOCK",
          entityType: "demands",
          entityId: demandId,
          after: { message },
          correlationId: randomUUID(),
        },
      });
      throw error;
    }
  }

  /** follow-up: also used by `GitService.commit()` to locate the same clone. */
  resolveClonePath(workspacePath: string, externalReference: string): string {
    const repoDirName = externalReference.split("/").pop() ?? externalReference;
    return path.join(workspacePath, "artefatos", repoDirName);
  }

  /**
   * One entry per (Artifact, Repository) link — NOT deduplicated by
   * repositoryId, since several Artifacts (different real repos) can now
   * share the same Repository row (the shared org/host base). `Repository`
   * has no `@relation` back to `ArtifactRepository` (matches this schema's
   * existing convention of plain scalar FKs for simple lookups), so
   * repositories are fetched separately and joined in memory.
   */
  private async resolveArtifactRepositoryLinks(demandId: string): Promise<ArtifactRepositoryLink[]> {
    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { repositories: true },
    });
    const repositoryIds = [
      ...new Set(artifacts.flatMap((a) => a.repositories.map((r) => r.repositoryId))),
    ];
    if (repositoryIds.length === 0) return [];

    const repositories = await this.prisma.db.repository.findMany({
      where: { id: { in: repositoryIds } },
    });
    const repositoryById = new Map(repositories.map((r) => [r.id, r]));

    const links: ArtifactRepositoryLink[] = [];
    for (const artifact of artifacts) {
      for (const link of artifact.repositories) {
        const repository = repositoryById.get(link.repositoryId);
        if (!repository) continue;
        links.push({
          artifactId: artifact.id,
          repositoryId: link.repositoryId,
          externalReference: composeOwnerRepo(repository.externalReference, artifact.name),
        });
      }
    }
    return links;
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
   * feature 005 FR-023: whenever at least one file is DISCOVERED, the
   * underlying `Artifact` (name/type) is also cataloged as a `SystemArtifact`
   * under the demand's selected Sistema, so the reusable catalog benefits
   * from the same discovery.
   */
  async recordImplementationFiles(demandId: string, artifactId: string, filesChanged: string[]) {
    const plannedFiles = new Set(
      (
        await this.prisma.db.artifactFile.findMany({
          where: { artifactId, changeType: { not: "DISCOVERED" } },
        })
      ).map((f) => f.filePath),
    );

    const created = await Promise.all(
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

    if (created.some((f) => f.changeType === "DISCOVERED")) {
      const artifact = await this.prisma.db.artifact.findUnique({ where: { id: artifactId } });
      if (artifact) {
        await this.ensureSystemArtifactCataloged(demandId, artifact.name, artifact.type);
      }
    }

    return created;
  }

  /**
   * feature 005 FR-023 (research.md §6, Clarifications 2026-08-10): catalogs
   * `name`/`type` as a `SystemArtifact` under the demand's first selected
   * Sistema, and immediately selects it for this demand (`DemandSystemArtifact`)
   * — preserves today's visible behavior (the item shows up on the demand)
   * while also enriching the reusable catalog. No-op if the demand has no
   * Sistema selected yet (spec.md Edge Cases — nothing to catalog into).
   * Idempotent: reuses an existing `SystemArtifact` with the same
   * `(systemId, name)` instead of creating a duplicate on every discovery.
   */
  async ensureSystemArtifactCataloged(demandId: string, name: string, type: string): Promise<void> {
    const [firstSelection] = await this.prisma.db.demandSystem.findMany({
      where: { demandId, stAtivo: true },
      orderBy: { systemId: "asc" },
      take: 1,
    });
    if (!firstSelection) return;

    let systemArtifact = await this.prisma.db.systemArtifact.findFirst({
      where: { systemId: firstSelection.systemId, name },
    });
    if (!systemArtifact) {
      systemArtifact = await this.prisma.db.systemArtifact.create({
        data: { systemId: firstSelection.systemId, name, type },
      });
    }

    await this.prisma.db.demandSystemArtifact.upsert({
      where: {
        demandId_systemArtifactId: { demandId, systemArtifactId: systemArtifact.id },
      },
      update: { stAtivo: true },
      create: { demandId, systemArtifactId: systemArtifact.id },
    });
  }

  private buildBranchName(policy: string, demand: { type: string; externalId: string }): string {
    const slug = demand.externalId.toLowerCase();
    return policy
      .replace("<type>", demand.type.toLowerCase())
      .replace("<client>", "client")
      .replace("<ticket>-<slug>", slug);
  }
}
