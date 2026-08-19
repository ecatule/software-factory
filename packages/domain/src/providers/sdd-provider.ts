export interface SDDInput {
  demandId: string;
  workspacePath: string;
  context?: Record<string, unknown>;
  /** follow-up: lets a provider that shells out to a real subprocess (SpecKitProvider) track and later kill that specific process on cancel(). */
  executionId?: string;
}

export interface ArtifactResult {
  documentPath: string;
  content: string;
}

export interface ImplementationResult {
  filesChanged: string[];
  summary: string;
  /**
   * follow-up: `/speckit-implement` is the only stage that can rewrite
   * `spec.md`/`tasks.md` AFTER they were already generated (e.g. to record
   * an assumption it had to make unattended, no analyst available) — relread
   * best-effort right after the run so callers can detect/persist that
   * without duplicating "find the feature dir" logic outside the provider.
   * Undefined when the file doesn't exist (never thrown for this).
   */
  specContent?: string;
  tasksContent?: string;
}

/**
 * spec FR-009: the SDD pipeline (Specify/Clarify/Plan/Checklist/Tasks/
 * Analyze/Implement) reached only through this interface, so the underlying
 * SDD tooling (Spec Kit first) is replaceable.
 */
export interface SDDProvider {
  specify(input: SDDInput): Promise<ArtifactResult>;
  clarify(input: SDDInput): Promise<ArtifactResult>;
  plan(input: SDDInput): Promise<ArtifactResult>;
  checklist(input: SDDInput): Promise<ArtifactResult>;
  tasks(input: SDDInput): Promise<ArtifactResult>;
  analyze(input: SDDInput): Promise<ArtifactResult>;
  implement(input: SDDInput): Promise<ImplementationResult>;
  /**
   * follow-up: real cancellation — previously "Cancelar" only flipped the
   * AgentExecution's DB status, leaving the actual subprocess running
   * unattended (live-observed: it kept running for minutes, then its own
   * completion/failure overwrote the CANCELLED status back to FAILED).
   * Optional — not every provider necessarily shells out to a killable
   * process (Provider Abstraction). Returns whether a running process was
   * actually found and killed.
   */
  cancel?(executionId: string): boolean;
}

export const SDD_PROVIDER = Symbol("SDD_PROVIDER");
