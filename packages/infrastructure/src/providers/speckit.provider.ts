import { exec } from "node:child_process";
import { promisify } from "node:util";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactResult,
  ImplementationResult,
  SDDInput,
  SDDProvider,
} from "@software-factory/domain";

const execAsync = promisify(exec);

export interface SpecKitAuthProfile {
  oauthToken?: string;
  apiKey?: string;
  configDir?: string;
}

interface SpecKitConfig {
  /** Spec Kit scaffolding CLI — only used once per workspace, for `init`. */
  specifyCommand?: string;
  /** Claude Code CLI — drives every SDD stage headlessly ("Modo B"). */
  claudeCommand?: string;
  /** Used when neither ProviderConfiguration nor the caller specify a model. */
  defaultModel?: string;
  /** Defensive cap so a hung subprocess never blocks the BullMQ worker forever. */
  timeoutMs?: number;
  /** authProfileKey (ProviderConfiguration.settings.authProfileKey) -> credentials, resolved from env only — never persisted. */
  authProfiles?: Record<string, SpecKitAuthProfile>;
}

const STAGE_TO_OUTPUT_FILE: Record<
  "specify" | "clarify" | "plan" | "checklist" | "tasks" | "analyze",
  string
> = {
  specify: "spec.md",
  clarify: "spec.md",
  plan: "plan.md",
  checklist: "checklists/requirements.md",
  tasks: "tasks.md",
  analyze: "analysis.md",
};

const CLARIFY_UNATTENDED_NOTE =
  "Running unattended (no human available): for every clarification question, " +
  "automatically accept the Recommended/Suggested option instead of waiting for a reply.";

/**
 * spec FR-009: the only adapter that shells out to the SDD pipeline.
 *
 * "Modo B": each stage runs the real Claude Code CLI (`claude -p
 * "/speckit-<stage> ..."`) headlessly inside the demand's workspace — the
 * Spec Kit CLI itself (`specify`) only scaffolds `.specify/`/`.claude/`
 * once via `init`; it has no subcommand that generates spec/plan/tasks
 * content on its own. That generation only happens inside an AI coding
 * agent interpreting the scaffolded slash-commands, which is what this
 * class now drives non-interactively.
 *
 * NOTE: requires both the `specify` and `claude` CLIs to be installed, on
 * PATH, and (for `claude`) authenticated for the BullMQ worker process —
 * an infrastructure/deployment concern, not something this adapter can
 * satisfy on its own.
 */
export class SpecKitProvider implements SDDProvider {
  private readonly specifyCommand: string;
  private readonly claudeCommand: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: SpecKitConfig = {}) {
    this.specifyCommand = config.specifyCommand ?? "specify";
    this.claudeCommand = config.claudeCommand ?? "claude";
    this.timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;
  }

  async specify(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("specify", input);
  }

  async clarify(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("clarify", input);
  }

  async plan(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("plan", input);
  }

  async checklist(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("checklist", input);
  }

  async tasks(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("tasks", input);
  }

  async analyze(input: SDDInput): Promise<ArtifactResult> {
    return this.runStage("analyze", input);
  }

  async implement(input: SDDInput): Promise<ImplementationResult> {
    await this.ensureInitialized(input.workspacePath);
    const summary = await this.runClaude("implement", "/speckit-implement", input);
    const filesChanged = await this.collectChangedFiles(input.workspacePath);
    return { filesChanged, summary };
  }

  private async runStage(
    stage: keyof typeof STAGE_TO_OUTPUT_FILE,
    input: SDDInput,
  ): Promise<ArtifactResult> {
    await this.ensureInitialized(input.workspacePath);

    const description = input.context?.description as string | undefined;
    if (stage === "specify" && !description?.trim()) {
      throw new Error(
        'SDD stage "specify" needs a non-empty description — pass it via SDDInput.context.description ' +
          "(the skill refuses to run without one).",
      );
    }

    const prompt =
      stage === "specify"
        ? `/speckit-specify ${description}`
        : stage === "clarify"
          ? `/speckit-clarify\n\n${CLARIFY_UNATTENDED_NOTE}`
          : `/speckit-${stage}`;
    await this.runClaude(stage, prompt, input);

    // The real Spec Kit CLI writes into a dynamically numbered
    // `specs/<NNN-slug>/` feature directory (created by `specify`, reused
    // by every later stage) — not a fixed path, so it's resolved after the
    // fact rather than assumed.
    const featureDir = await this.resolveFeatureDir(input.workspacePath);
    const documentPath = path.join(featureDir, STAGE_TO_OUTPUT_FILE[stage]);
    const content = await readFile(documentPath, "utf-8");
    return { documentPath, content };
  }

  /** Each demand's workspace is a fresh Spec Kit project, so `specs/` holds exactly one feature dir — pick the newest if more than one ever appears. */
  private async resolveFeatureDir(workspacePath: string): Promise<string> {
    const specsRoot = path.join(workspacePath, "specs");
    const entries = await readdir(specsRoot, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const latest = dirs.at(-1);
    if (!latest) {
      throw new Error(`No feature directory found under ${specsRoot} after running the stage.`);
    }
    return path.join(specsRoot, latest);
  }

  /**
   * Lazily scaffolds `.specify/`/`.claude/` once per workspace — never
   * re-runs after that. `--force`/`--ignore-agent-tools` keep this
   * non-interactive: no confirmation prompt, no coding-agent-detection
   * check that could hang a headless worker.
   */
  private async ensureInitialized(workspacePath: string): Promise<void> {
    const marker = path.join(workspacePath, ".specify");
    try {
      await access(marker);
      return;
    } catch {
      // not initialized yet — fall through
    }
    await execAsync(
      `${this.specifyCommand} init . --integration claude --force --ignore-agent-tools`,
      { cwd: workspacePath, timeout: this.timeoutMs },
    );
  }

  private async runClaude(
    stageLabel: string,
    prompt: string,
    input: SDDInput,
  ): Promise<string> {
    const model = (input.context?.model as string | undefined) ?? this.config.defaultModel;
    const authProfileKey = input.context?.authProfileKey as string | undefined;
    const profile = authProfileKey ? this.config.authProfiles?.[authProfileKey] : undefined;

    const env = { ...process.env };
    if (profile?.configDir) env.CLAUDE_CONFIG_DIR = profile.configDir;
    if (profile?.oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = profile.oauthToken;
    if (profile?.apiKey) env.ANTHROPIC_API_KEY = profile.apiKey;

    const modelFlag = model ? ` --model ${JSON.stringify(model)}` : "";
    const command =
      `${this.claudeCommand} -p ${JSON.stringify(prompt)} --dangerously-skip-permissions` +
      `${modelFlag} --output-format json`;

    try {
      const { stdout } = await execAsync(command, {
        cwd: input.workspacePath,
        timeout: this.timeoutMs,
        env,
      });
      return stdout.trim();
    } catch (error) {
      const cause = error as NodeJS.ErrnoException & { stderr?: string };
      if (cause.code === "ENOENT") {
        throw new Error(
          `SDD stage "${stageLabel}" failed: the "${this.claudeCommand}" CLI was not found on ` +
            "PATH for the worker process. Install and authenticate Claude Code where the " +
            "BullMQ worker runs.",
        );
      }
      throw new Error(
        `SDD stage "${stageLabel}" failed: ${cause.message}${cause.stderr ? `\n${cause.stderr}` : ""}`,
      );
    }
  }

  /**
   * `implement` may touch multiple cloned repositories under `artefatos/`
   * (DeveloperAgentService.ensureRepositoriesCloned) — headless Claude
   * Code's stdout isn't a reliable source for "which files changed", so
   * this asks each local clone directly instead.
   */
  private async collectChangedFiles(workspacePath: string): Promise<string[]> {
    const artefatosDir = path.join(workspacePath, "artefatos");
    let repoDirs: string[];
    try {
      const { readdir } = await import("node:fs/promises");
      repoDirs = await readdir(artefatosDir);
    } catch {
      return [];
    }

    const changed: string[] = [];
    for (const repoDir of repoDirs) {
      const repoPath = path.join(artefatosDir, repoDir);
      try {
        const { stdout } = await execAsync("git status --porcelain", { cwd: repoPath });
        for (const line of stdout.split("\n")) {
          const filePath = line.slice(3).trim();
          if (filePath) changed.push(path.join(repoDir, filePath));
        }
      } catch {
        // not a git repo (or git missing) — skip, matches the pre-existing
        // "artefatos/" layout for artifacts with no linked repository.
      }
    }
    return changed;
  }
}
