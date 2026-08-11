import { Injectable, NotFoundException } from "@nestjs/common";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";

/**
 * Resolved relative to this compiled file (not `process.cwd()`, which
 * varies depending on where the process is launched from — that variance
 * caused workspaces to be created outside the repository entirely when the
 * API was started from the monorepo root instead of `apps/api/`). Override
 * with `WORKSPACE_ROOT` in `.env` for deployments where this file's
 * location relative to the repo root differs (e.g. containerized builds).
 */
export const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT ?? path.resolve(__dirname, "../../../../../workspace");

const DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * spec FR-013/FR-014: creates exactly two areas under
   * `workspace/<ticket>-<slug>/` — `spec/` (SDD documents only) and
   * `artefatos/` (code artifacts only). No repository is ever placed
   * directly at the `spec/` level.
   */
  async createForDemand(demandId: string) {
    const existing = await this.prisma.db.demandWorkspace.findUnique({ where: { demandId } });
    if (existing) return existing;

    const demand = await this.prisma.db.demand.findUniqueOrThrow({ where: { id: demandId } });
    const dirName = `${demand.externalId}-${slugify(demand.title)}`;
    const workspacePath = path.join(WORKSPACE_ROOT, dirName);

    await mkdir(path.join(workspacePath, "spec"), { recursive: true });
    await mkdir(path.join(workspacePath, "artefatos"), { recursive: true });

    return this.prisma.db.demandWorkspace.create({
      data: { demandId, path: workspacePath, status: "CREATED" },
    });
  }

  /** spec 002 FR-013: list workspaces across the platform, not just by demand id. */
  list(demandId: string | undefined, page: number, pageSize: number) {
    const where = demandId ? { demandId } : undefined;
    return paginate(
      (skip, take) =>
        this.prisma.db.demandWorkspace.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
      () => this.prisma.db.demandWorkspace.count({ where }),
      page,
      pageSize,
    );
  }

  async get(id: string) {
    const workspace = await this.prisma.db.demandWorkspace.findUnique({ where: { id } });
    if (!workspace) throw new NotFoundException(`Workspace ${id} not found`);
    return workspace;
  }

  getByDemandId(demandId: string) {
    return this.prisma.db.demandWorkspace.findUnique({ where: { demandId } });
  }

  async tree(id: string) {
    const workspace = await this.get(id);
    const [specFiles, artifactDirs] = await Promise.all([
      this.safeList(path.join(workspace.path, "spec")),
      this.safeList(path.join(workspace.path, "artefatos")),
    ]);

    const artefatos = await Promise.all(
      artifactDirs.map(async (dirName) => ({
        artifact: dirName,
        files: await this.safeList(path.join(workspace.path, "artefatos", dirName)),
      })),
    );

    return { spec: specFiles, artefatos };
  }

  async readFile(id: string, relativePath: string) {
    const workspace = await this.get(id);
    const fullPath = path.join(workspace.path, relativePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(workspace.path))) {
      throw new NotFoundException("Path escapes workspace root");
    }
    const content = await readFile(resolved, "utf-8");
    return { path: relativePath, content };
  }

  private async safeList(dir: string): Promise<string[]> {
    try {
      return await readdir(dir);
    } catch {
      return [];
    }
  }
}
