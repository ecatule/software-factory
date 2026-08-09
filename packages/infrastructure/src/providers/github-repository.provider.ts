import { exec } from "node:child_process";
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

  async createBranch(externalReference: string, branchName: string): Promise<BranchRef> {
    // Assumes `cloneRepository` already ran against the workspace at cwd.
    await execAsync(`git checkout -b ${branchName}`, { cwd: this.repoDir(externalReference) });
    return { name: branchName };
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

  async commit(externalReference: string, branch: string, message: string): Promise<CommitRef> {
    const cwd = this.repoDir(externalReference);
    await execAsync(`git checkout ${branch}`, { cwd });
    await execAsync(`git add -A`, { cwd });
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd });
    const { stdout } = await execAsync(`git rev-parse HEAD`, { cwd });
    return { sha: stdout.trim() };
  }

  async push(externalReference: string, branch: string): Promise<void> {
    await execAsync(`git push origin ${branch}`, { cwd: this.repoDir(externalReference) });
  }

  async createPullRequest(
    externalReference: string,
    branch: string,
    title: string,
    description: string,
  ): Promise<PullRequestRef> {
    const data = await this.api(`/repos/${externalReference}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title, body: description, head: branch, base: "main" }),
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

  private repoDir(externalReference: string): string {
    return externalReference.split("/").pop() ?? externalReference;
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
