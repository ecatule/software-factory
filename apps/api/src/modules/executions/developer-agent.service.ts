import { Inject, Injectable } from "@nestjs/common";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  CODE_REPOSITORY_PROVIDER,
  type CodeRepositoryProvider,
} from "@software-factory/domain";
import { PrismaService } from "../../common/prisma/prisma.service";
import { WORKSPACE_ROOT, slugify } from "../workspaces/workspaces.service";
import {
  loadProjectAllowedHosts,
  loadProjectAllowedSecrets,
  loadProjectExcludedFiles,
  loadProjectSanitizationRules,
} from "./project-environment-config";
import { assertRepositoriesAreProductionSafe, sanitizeRepositories } from "./production-reference.guard";
import { composeOwnerRepo } from "./repository-reference";

const execAsync = promisify(exec);

interface ArtifactRepositoryLink {
  artifactId: string;
  repositoryId: string;
  /** Composed "owner/repo" — see repository-reference.ts. */
  externalReference: string;
  /** follow-up: threaded through to `createBranch()` so new branches fork from production, not GitHub's own default branch. */
  productionBranch: string | null;
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
      await this.codeRepositoryProvider.createBranch(
        link.externalReference,
        branchName,
        link.productionBranch ?? undefined,
      );
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
    const allowedSecrets = await loadProjectAllowedSecrets(demand.projectId);
    const allowedHosts = await loadProjectAllowedHosts(demand.projectId);
    const excludedFiles = await loadProjectExcludedFiles(demand.projectId);

    const changes = await sanitizeRepositories(repoPaths, rules, excludedFiles);
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
      await assertRepositoriesAreProductionSafe(repoPaths, allowedSecrets, allowedHosts, excludedFiles);
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

  /**
   * follow-up: `/speckit-implement` only ever finds work if
   * `specs/<NNN-slug>/spec.md`/`plan.md` exist — real Spec Kit writes these
   * when `/speckit-specify`/`/speckit-plan` run for real. When a demand's
   * SPEC/PLAN content instead comes from "Anexar arquivos prontos" (a
   * manual, Postgres-only upload) or the "Aprovar e executar" review step,
   * those files never existed. Just the FETCH half of the fix — resolves
   * the demand's current (`Specification.currentVersionId`) SPEC/PLAN
   * content so `ExecutionsProcessor` can pass it through `SDDInput.context`
   * to `SpecKitProvider`, which does the actual filesystem sync (must
   * happen there, strictly AFTER `specify init` runs — that command can
   * overwrite `.specify/`, so writing the feature files before it would
   * risk them being wiped).
   */
  async resolveCurrentSpecAndPlanContent(demandId: string): Promise<{
    specContent?: string;
    planContent?: string;
    // follow-up: also returns the version IDs actually used (not just their
    // content) — `ExecutionsService.retry()` compares these against a new
    // Retry attempt's current SPEC/PLAN to decide whether it's safe to skip
    // straight to `implement` (tasks/analyze/checklist already succeeded)
    // or whether the SPEC/PLAN changed since, and the whole pipeline needs
    // to run again from scratch.
    specVersionId?: string;
    planVersionId?: string;
  }> {
    const specifications = await this.prisma.db.specification.findMany({
      where: { demandId, documentType: { in: ["SPEC", "PLAN"] } },
    });

    const result: {
      specContent?: string;
      planContent?: string;
      specVersionId?: string;
      planVersionId?: string;
    } = {};
    for (const specification of specifications) {
      if (!specification.currentVersionId) continue;
      const version = await this.prisma.db.specificationVersion.findUnique({
        where: { id: specification.currentVersionId },
      });
      if (!version) continue;
      if (specification.documentType === "SPEC") {
        result.specContent = version.content;
        result.specVersionId = version.id;
      }
      if (specification.documentType === "PLAN") {
        result.planContent = version.content;
        result.planVersionId = version.id;
      }
    }
    return result;
  }

  /** follow-up: also used by `GitService.commit()` to locate the same clone. */
  resolveClonePath(workspacePath: string, externalReference: string): string {
    const repoDirName = externalReference.split("/").pop() ?? externalReference;
    return path.join(workspacePath, "artefatos", repoDirName);
  }

  /** follow-up: public wrapper around `resolveArtifactRepositoryLinks` for callers (ExecutionsProcessor) that only need `(artifactId, repoPath)` pairs, not the full link shape. */
  async resolveArtifactRepositoryPaths(
    demandId: string,
    workspacePath: string,
  ): Promise<{ artifactId: string; repoPath: string }[]> {
    const links = await this.resolveArtifactRepositoryLinks(demandId);
    return links.map((link) => ({
      artifactId: link.artifactId,
      repoPath: this.resolveClonePath(workspacePath, link.externalReference),
    }));
  }

  /**
   * follow-up: snapshots each repo's dirty (uncommitted) file paths via
   * `git status --porcelain`. Called BEFORE and AFTER `implement` so the
   * automated post-implement commit can stage only files that became dirty
   * DURING this run — never files that were already sitting uncommitted in
   * the working tree beforehand (e.g. leftover local edits unrelated to
   * this demand). Returns an empty set for a path that isn't a git repo.
   */
  async snapshotDirtyFiles(repoPaths: string[]): Promise<Map<string, Set<string>>> {
    const snapshot = new Map<string, Set<string>>();
    for (const repoPath of repoPaths) {
      try {
        const { stdout } = await execAsync("git status --porcelain", { cwd: repoPath });
        const files = new Set(
          stdout
            .split("\n")
            .map((line) => line.slice(3).trim())
            .filter(Boolean),
        );
        snapshot.set(repoPath, files);
      } catch {
        snapshot.set(repoPath, new Set());
      }
    }
    return snapshot;
  }

  /**
   * follow-up: the Developer Agent runs headlessly with real shell access
   * inside the clone — live-observed it committing directly via `git
   * commit` during `/speckit-implement`, bypassing `GitService.commit()`
   * entirely (no Test Gate check, no `Commit` row, no push). Postgres has
   * no record of a commit that never went through that method, so
   * detecting "local commits the remote doesn't have yet" can only happen
   * by asking the clone itself — same best-effort, swallow-on-error
   * pattern as `snapshotDirtyFiles` above, deliberately not going through
   * `CodeRepositoryProvider` (this is workspace introspection, not a
   * provider-abstracted remote operation). Compares explicitly against
   * `origin/<branchName>` (not `@{u}`) since the caller already knows the
   * branch name from the `Branch` row — more robust than relying on
   * whatever upstream tracking happened to be set at clone/checkout time.
   */
  async detectUnpushedCommits(
    entries: Array<{ artifactId: string; repoPath: string; branchName: string }>,
  ): Promise<Array<{ artifactId: string; commits: { sha: string; message: string }[] }>> {
    const results: Array<{ artifactId: string; commits: { sha: string; message: string }[] }> = [];
    for (const { artifactId, repoPath, branchName } of entries) {
      try {
        await execAsync(`git fetch origin ${branchName}`, { cwd: repoPath });
        const { stdout } = await execAsync(`git log --oneline origin/${branchName}..HEAD`, { cwd: repoPath });
        const lines = stdout.split("\n").filter(Boolean);
        if (lines.length === 0) continue;
        results.push({
          artifactId,
          commits: lines.map((line) => {
            const [sha, ...rest] = line.split(" ");
            return { sha, message: rest.join(" ") };
          }),
        });
      } catch {
        // not a git repo, no network, remote branch never existed, etc. — best-effort
      }
    }
    return results;
  }

  /**
   * follow-up: used to resolve `Repository` per (Artifact, ArtifactRepository)
   * link — but `ArtifactRepository` is copied once from the CATALOG
   * `SystemArtifact` (`DemandsService.ensureArtifactsForSystemArtifacts`),
   * and that catalog is shared across every Project/client (the same
   * `SystemArtifact` "api-vexur-x" is reused everywhere). Live-observed: a
   * demand under Project "Vexur - Corpe Saúde" cloned and branched from the
   * generic "Vexur" Project's Repository instead — wrong `productionBranch`,
   * and its safety-check correctly caught a DIFFERENT client's production
   * secret leaking through as a result. `Demand.projectId`/`Repository.projectId`
   * are both required scalar FKs (1:1), and today every Project has exactly
   * one active Repository — so resolving by the demand's own Project is a
   * safe, non-lossy fix, not a simplification that loses information.
   * `ArtifactRepository` links are still read here (unchanged elsewhere) —
   * only as an eligibility signal ("this artifact has a repository
   * configured at all"), the same one `GitService` already uses
   * independently to gate commits; WHICH repository they point at no
   * longer matters for this method's own resolution.
   */
  private async resolveArtifactRepositoryLinks(demandId: string): Promise<ArtifactRepositoryLink[]> {
    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const repository = await this.prisma.db.repository.findFirst({
      where: { projectId: demand.projectId, stAtivo: true },
    });
    if (!repository) return [];

    const artifacts = await this.prisma.db.artifact.findMany({
      where: { demandId },
      include: { repositories: true },
    });

    return artifacts
      .filter((artifact) => artifact.repositories.length > 0)
      .map((artifact) => ({
        artifactId: artifact.id,
        repositoryId: repository.id,
        externalReference: composeOwnerRepo(repository.externalReference, artifact.name),
        productionBranch: repository.productionBranch,
      }));
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

  /**
   * follow-up: `<slug>` was declared in `branchNamingPolicy`'s default
   * template but never actually implemented — `<ticket>-<slug>` collapsed
   * to just the ticket, so every branch name (e.g. `feature/client/456123`)
   * carried no hint of what the demand was actually about. Now folds in a
   * short slug of the demand's title, e.g.
   * `feature/client/456123-tipo-de-tabela-de-preco`. Falls back to the bare
   * ticket when the title yields no usable slug (e.g. empty title, or only
   * punctuation/diacritics-only content).
   */
  private buildBranchName(
    policy: string,
    demand: { type: string; externalId: string; title: string },
  ): string {
    const ticket = demand.externalId.toLowerCase();
    const titleSlug = slugify(demand.title).split("-").filter(Boolean).slice(0, 5).join("-");
    const ticketSlug = titleSlug ? `${ticket}-${titleSlug}` : ticket;
    return policy
      .replace("<type>", demand.type.toLowerCase())
      .replace("<client>", "client")
      .replace("<ticket>-<slug>", ticketSlug);
  }
}
