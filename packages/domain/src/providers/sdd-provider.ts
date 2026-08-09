export interface SDDInput {
  demandId: string;
  workspacePath: string;
  context?: Record<string, unknown>;
}

export interface ArtifactResult {
  documentPath: string;
  content: string;
}

export interface ImplementationResult {
  filesChanged: string[];
  summary: string;
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
}

export const SDD_PROVIDER = Symbol("SDD_PROVIDER");
