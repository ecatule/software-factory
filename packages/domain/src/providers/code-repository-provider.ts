export interface RepositoryRef {
  externalReference: string;
}

export interface BranchRef {
  name: string;
}

export interface FileRef {
  path: string;
  content: string;
}

export interface CommitRef {
  sha: string;
}

export interface PullRequestRef {
  externalReference: string;
  url: string;
  status: string;
}

export interface CheckRef {
  name: string;
  status: string;
}

/**
 * spec FR-018: the platform's only integration point with a code host
 * (GitHub first). Used by the Developer Agent (US6) and the commit/PR flow
 * (US8) — never called directly from apps/web.
 */
export interface CodeRepositoryProvider {
  getRepository(externalReference: string): Promise<RepositoryRef>;
  cloneRepository(externalReference: string, targetPath: string): Promise<void>;
  /**
   * `baseBranch`, when given, is the branch to fork from (e.g. the
   * Repository's configured `productionBranch`) instead of whatever GitHub
   * reports as the repo's own default branch. Implementations should fall
   * back to the repo's actual default branch if `baseBranch` doesn't exist
   * on that specific repo (a shared `Repository` row's `productionBranch`
   * isn't guaranteed to apply to every real repo it backs).
   */
  createBranch(externalReference: string, branchName: string, baseBranch?: string): Promise<BranchRef>;
  /** Checks out `branchName` inside the clone at `targetPath` (creating it locally if new). */
  checkoutBranch(targetPath: string, branchName: string): Promise<void>;
  getFile(externalReference: string, branch: string, path: string): Promise<FileRef>;
  searchCode(externalReference: string, query: string): Promise<FileRef[]>;
  /**
   * `targetPath` is the local clone's absolute path (same convention as
   * `checkoutBranch`). `filePaths`, when given, stages ONLY those paths
   * (relative to `targetPath`) instead of every dirty file — needed so an
   * automated commit never sweeps up unrelated changes that were already
   * sitting in the working tree before this run started.
   */
  commit(
    externalReference: string,
    targetPath: string,
    branch: string,
    message: string,
    filePaths?: string[],
  ): Promise<CommitRef>;
  push(externalReference: string, targetPath: string, branch: string): Promise<void>;
  /**
   * `baseBranch`, when given, is the PR's merge target (the Repository's
   * configured `homologationBranch` — a PR must never target the production
   * branch). Implementations fall back to the repo's own default branch when
   * omitted or when it doesn't exist on that specific repo, same convention
   * as `createBranch`.
   */
  createPullRequest(
    externalReference: string,
    branch: string,
    title: string,
    description: string,
    baseBranch?: string,
  ): Promise<PullRequestRef>;
  getPullRequest(externalReference: string, prReference: string): Promise<PullRequestRef>;
  getChecks(externalReference: string, prReference: string): Promise<CheckRef[]>;
}

export const CODE_REPOSITORY_PROVIDER = Symbol("CODE_REPOSITORY_PROVIDER");
