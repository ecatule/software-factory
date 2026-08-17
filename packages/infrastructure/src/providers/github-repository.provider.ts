import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  BranchRef,
  CheckRef,
  CodeRepositoryProvider,
  CommitRef,
  FileRef,
  PullRequestRef,
  RepositoryRef,
} from "@software-factory/domain";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface GitHubConfig {
  apiUrl: string;
  token: string;
}

/**
 * spec FR-018: the only place the platform talks to GitHub — both its REST
 * API (repository/PR/checks metadata) and the `git` CLI (clone/branch/
 * commit/push against a demand's local workspace clone). Used by the
 * Developer Agent (US6) and the commit/PR flow (US8).
 */
export class GitHubRepositoryProvider implements CodeRepositoryProvider {
  constructor(private readonly config: GitHubConfig) {}

  async getRepository(externalReference: string): Promise<RepositoryRef> {
    await this.api(`/repos/${externalReference}`);
    return { externalReference };
  }

  async cloneRepository(externalReference: string, targetPath: string): Promise<void> {
    const url = `https://x-access-token:${this.config.token}@github.com/${externalReference}.git`;
    await execAsync(`git clone ${url} "${targetPath}"`);
  }

  /**
   * `ensureBranchesForDemand` calls this BEFORE any clone exists
   * (`ensureRepositoriesCloned` runs after) — there is no local working
   * copy to `git checkout -b` against yet, so the branch is created
   * directly via the GitHub REST API. Forks from `baseBranch` when given
   * (falling back to the repo's own default branch if that ref doesn't
   * exist on this specific repo) — otherwise from the repo's default
   * branch, same as before. `checkoutBranch` (called later, once a real
   * clone exists) checks it out locally. Idempotent: a 422 means the ref
   * already exists (e.g. a retry after a partial earlier failure), treated
   * as success.
   */
  async createBranch(externalReference: string, branchName: string, baseBranch?: string): Promise<BranchRef> {
    const repo = await this.api(`/repos/${externalReference}`);
    let baseRef: any;
    if (baseBranch) {
      try {
        baseRef = await this.api(`/repos/${externalReference}/git/ref/heads/${baseBranch}`);
      } catch {
        baseRef = undefined;
      }
    }
    if (!baseRef) {
      baseRef = await this.api(`/repos/${externalReference}/git/ref/heads/${repo.default_branch}`);
    }
    try {
      await this.api(`/repos/${externalReference}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseRef.object.sha }),
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("422")) throw error;
    }
    return { name: branchName };
  }

  /**
   * Unlike `createBranch` (relative cwd, assumes the clone is a sibling of
   * the API process's own cwd), this takes the clone's absolute path
   * directly — used by `DeveloperAgentService.ensureRepositoriesCloned()`
   * against a demand-specific `artefatos/<repo>/` clone.
   */
  async checkoutBranch(targetPath: string, branchName: string): Promise<void> {
    try {
      await execAsync(`git checkout ${branchName}`, { cwd: targetPath });
    } catch {
      await execAsync(`git checkout -b ${branchName}`, { cwd: targetPath });
    }
  }

  async getFile(externalReference: string, branch: string, filePath: string): Promise<FileRef> {
    const data = await this.api(
      `/repos/${externalReference}/contents/${filePath}?ref=${branch}`,
    );
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { path: filePath, content };
  }

  async searchCode(externalReference: string, query: string): Promise<FileRef[]> {
    const data = await this.api(
      `/search/code?q=${encodeURIComponent(query)}+repo:${externalReference}`,
    );
    return (data.items ?? []).map((item: { path: string }) => ({ path: item.path, content: "" }));
  }

  async commit(
    externalReference: string,
    targetPath: string,
    branch: string,
    message: string,
    filePaths?: string[],
  ): Promise<CommitRef> {
    await execAsync(`git checkout ${branch}`, { cwd: targetPath });
    if (filePaths && filePaths.length > 0) {
      // execFile (argv array, no shell) — file paths come from `git status
      // --porcelain` output and could contain spaces/quotes; never safe to
      // interpolate into a shell string the way the -A case below does.
      await execFileAsync("git", ["add", "--", ...filePaths], { cwd: targetPath });
    } else {
      await execAsync(`git add -A`, { cwd: targetPath });
    }
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: targetPath });
    const { stdout } = await execAsync(`git rev-parse HEAD`, { cwd: targetPath });
    return { sha: stdout.trim() };
  }

  async push(externalReference: string, targetPath: string, branch: string): Promise<void> {
    await execAsync(`git push origin ${branch}`, { cwd: targetPath });
  }

  async createPullRequest(
    externalReference: string,
    branch: string,
    title: string,
    description: string,
    baseBranch?: string,
  ): Promise<PullRequestRef> {
    let base = baseBranch;
    if (base) {
      try {
        await this.api(`/repos/${externalReference}/git/ref/heads/${base}`);
      } catch {
        base = undefined;
      }
    }
    if (!base) {
      const repo = await this.api(`/repos/${externalReference}`);
      base = repo.default_branch;
    }
    const data = await this.api(`/repos/${externalReference}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title, body: description, head: branch, base }),
    });
    return { externalReference: String(data.number), url: data.html_url, status: data.state };
  }

  async getPullRequest(externalReference: string, prReference: string): Promise<PullRequestRef> {
    const data = await this.api(`/repos/${externalReference}/pulls/${prReference}`);
    return { externalReference: String(data.number), url: data.html_url, status: data.state };
  }

  async getChecks(externalReference: string, prReference: string): Promise<CheckRef[]> {
    const pr = await this.api(`/repos/${externalReference}/pulls/${prReference}`);
    const data = await this.api(`/repos/${externalReference}/commits/${pr.head.sha}/check-runs`);
    return (data.check_runs ?? []).map((run: { name: string; conclusion: string | null }) => ({
      name: run.name,
      status: run.conclusion ?? "pending",
    }));
  }

  private async api(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<any>;
  }
}
