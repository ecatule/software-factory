import { exec, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactResult,
  ImplementationResult,
  SDDInput,
  SDDProvider,
} from "@software-factory/domain";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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

const CHECKLIST_UNATTENDED_NOTE =
  "Running unattended (no human available): skip every clarifying question and generate the " +
  "checklist immediately using the stated defaults (Depth: Standard, Audience: Reviewer, " +
  "Focus: top relevance clusters inferred from spec/plan) without asking anything.";

const IMPLEMENT_UNATTENDED_NOTE =
  "Running unattended (no human available): a freshly generated checklist always starts with " +
  "every item unchecked, so if any checklist has incomplete items, treat that exactly as if a " +
  "human had already replied 'yes, proceed anyway' — continue straight into implementation " +
  "instead of stopping to ask.";

const DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

/** Mirrors WorkspacesService's slugify (apps/api) — duplicated rather than imported, since packages/infrastructure can't depend on apps/api. Capped at 5 words for a readable `specs/001-<slug>/` directory name. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .split("-")
    .slice(0, 5)
    .join("-");
}

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
  // follow-up: real cancellation — one entry per currently-running `claude`
  // subprocess, keyed by `SDDInput.executionId`. Only ever holds the ONE
  // process a given execution is waiting on at any moment (tasks, then
  // analyze, then checklist, then implement each register/unregister in
  // turn), never a stale/finished one — cleared in `runClaude`'s `finally`.
  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(private readonly config: SpecKitConfig = {}) {
    this.specifyCommand = config.specifyCommand ?? "specify";
    this.claudeCommand = config.claudeCommand ?? "claude";
    this.timeoutMs = config.timeoutMs ?? 10 * 60 * 1000;
  }

  /**
   * follow-up: live-observed that `child.kill()` alone is not enough on
   * Windows — `execAsync` runs the command through `cmd.exe`
   * (`spawn cmd.exe /d /s /c "claude ..."`), and Windows does not propagate
   * a kill signal from a parent to its children the way POSIX process
   * groups do. Killing just the `cmd.exe` PID left the real `claude.exe`
   * process running for minutes, which is exactly what happened here before
   * this fix — had to manually `Stop-Process` both PIDs. `taskkill /T`
   * kills the whole process tree in one call; POSIX `SIGKILL` is sufficient
   * there since `exec`'s shell (`/bin/sh -c`) typically execs into the
   * final command, replacing itself rather than forking a child.
   */
  cancel(executionId: string): boolean {
    const child = this.activeProcesses.get(executionId);
    if (!child || !child.pid) return false;
    if (process.platform === "win32") {
      execFileAsync("taskkill", ["/pid", String(child.pid), "/T", "/F"]).catch(() => {
        // best-effort — the process may have already exited on its own
      });
    } else {
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
    return true;
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
    await this.prepareWorkspace(input.workspacePath, input.context);
    const summary = await this.runClaude(
      "implement",
      `/speckit-implement\n\n${IMPLEMENT_UNATTENDED_NOTE}`,
      input,
    );
    const filesChanged = await this.collectChangedFiles(input.workspacePath);
    return { filesChanged, summary };
  }

  /** Shared by every stage (including `implement`): scaffold once, then sync the demand's current Postgres SPEC/PLAN onto disk. */
  private async prepareWorkspace(
    workspacePath: string,
    context: Record<string, unknown> | undefined,
  ): Promise<void> {
    await this.ensureInitialized(workspacePath, context?.constitution as string | undefined);
    await this.syncFeatureFiles(workspacePath, context);
  }

  private async runStage(
    stage: keyof typeof STAGE_TO_OUTPUT_FILE,
    input: SDDInput,
  ): Promise<ArtifactResult> {
    await this.prepareWorkspace(input.workspacePath, input.context);

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
          : stage === "checklist"
            ? `/speckit-checklist\n\n${CHECKLIST_UNATTENDED_NOTE}`
            : `/speckit-${stage}`;
    const rawOutput = await this.runClaude(stage, prompt, input);

    // The real Spec Kit CLI writes into a dynamically numbered
    // `specs/<NNN-slug>/` feature directory (created by `specify`, reused
    // by every later stage) — not a fixed path, so it's resolved after the
    // fact rather than assumed.
    const featureDir = await this.resolveFeatureDir(input.workspacePath);
    return this.resolveStageOutput(stage, featureDir, rawOutput);
  }

  /**
   * `tasks`/`specify`/`clarify`/`plan` write a fixed, well-known file — but
   * `checklist` names its own file dynamically (`ux.md`, `security.md`, ...)
   * and `analyze` is explicitly documented as STRICTLY READ-ONLY (it never
   * writes a file at all, only returns a report as CLI output) — both need
   * special handling instead of the fixed-path read every other stage uses.
   */
  private async resolveStageOutput(
    stage: keyof typeof STAGE_TO_OUTPUT_FILE,
    featureDir: string,
    rawOutput: string,
  ): Promise<ArtifactResult> {
    if (stage === "analyze") {
      const content = this.extractClaudeResultText(rawOutput);
      const documentPath = path.join(featureDir, STAGE_TO_OUTPUT_FILE.analyze);
      await writeFile(documentPath, content, "utf-8");
      return { documentPath, content };
    }

    if (stage === "checklist") {
      const checklistsDir = path.join(featureDir, "checklists");
      const entries = await readdir(checklistsDir, { withFileTypes: true }).catch(() => []);
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort();
      const latest = files.at(-1);
      if (!latest) {
        throw new Error(`SDD stage "checklist" produced no file under ${checklistsDir}.`);
      }
      const documentPath = path.join(checklistsDir, latest);
      const content = await readFile(documentPath, "utf-8");
      return { documentPath, content };
    }

    const documentPath = path.join(featureDir, STAGE_TO_OUTPUT_FILE[stage]);
    const content = await readFile(documentPath, "utf-8");
    return { documentPath, content };
  }

  /** `runClaude` returns the CLI's raw `--output-format json` stdout — pull out the human-readable `result` field when present. */
  private extractClaudeResultText(rawOutput: string): string {
    try {
      const parsed = JSON.parse(rawOutput) as { result?: string };
      if (typeof parsed.result === "string" && parsed.result.trim()) {
        return parsed.result;
      }
    } catch {
      // not JSON, or no "result" field — fall back to the raw output as-is
    }
    return rawOutput;
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
   *
   * follow-up (live-validation finding): `workspacePath` isn't always
   * created ahead of time — `DeveloperAgentService.resolveWorkspacePath`
   * falls back to `workspace/<demandId>` when no `DemandWorkspace` row
   * exists yet (nothing calls `POST /demands/:id/workspace` automatically),
   * and that fallback directory was never `mkdir`'d anywhere. Spawning a
   * child process with a `cwd` that doesn't exist fails at the OS level —
   * on Windows this surfaces as the misleading `spawn cmd.exe ENOENT`
   * rather than any mention of the missing directory. `mkdir` here is a
   * no-op once the real directory already exists (recursive), so this is
   * safe for both the fallback and the "real" workspace.
   */
  private async ensureInitialized(workspacePath: string, constitution?: string): Promise<void> {
    await mkdir(workspacePath, { recursive: true });
    // follow-up: `.specify/templates/` (not just bare `.specify/`) — only
    // the real `specify init` creates this. `syncFeatureFiles` below may
    // create `.specify/feature.json` ahead of a first-ever init on this
    // workspace; checking the bare directory would then wrongly read as
    // "already initialized" and skip `specify init` entirely, leaving the
    // workspace without the real `.claude/skills/`/`.specify/scripts/`
    // scaffold `/speckit-implement` itself depends on.
    const marker = path.join(workspacePath, ".specify", "templates");
    const alreadyInitialized = await this.pathExists(marker);
    if (!alreadyInitialized) {
      await execAsync(
        `${this.specifyCommand} init . --integration claude --force --ignore-agent-tools`,
        { cwd: workspacePath, timeout: this.timeoutMs },
      );
    }

    // follow-up: written on EVERY call (not just first init) so the latest
    // saved Project constitution is always what `/speckit-specify`,
    // `/speckit-plan`, etc. read — not just a one-time snapshot from
    // whenever this workspace happened to be first scaffolded. Overwrites
    // the blank template `specify init` creates.
    if (constitution?.trim()) {
      const constitutionPath = path.join(workspacePath, ".specify", "memory", "constitution.md");
      await mkdir(path.dirname(constitutionPath), { recursive: true });
      await writeFile(constitutionPath, constitution, "utf-8");
    }
  }

  /**
   * follow-up: `/speckit-implement` only ever finds work if
   * `specs/<NNN-slug>/spec.md`/`plan.md` exist — real Spec Kit writes these
   * when `/speckit-specify`/`/speckit-plan` run for real. When a demand's
   * approved SPEC/PLAN content instead came from a manual upload ("Anexar
   * arquivos prontos") or the "Aprovar e executar" review step, those files
   * never existed on disk. `ExecutionsProcessor` resolves the current
   * content from Postgres and passes it through `context.specContent`/
   * `context.planContent` (`context.demandTitle` names the feature
   * directory the first time) — this writes it into the workspace, called
   * strictly AFTER `ensureInitialized` (never before: `specify init` can
   * overwrite `.specify/`, which would risk wiping these files or
   * `feature.json` if they existed first).
   */
  private async syncFeatureFiles(
    workspacePath: string,
    context: Record<string, unknown> | undefined,
  ): Promise<void> {
    const specContent = context?.specContent as string | undefined;
    const planContent = context?.planContent as string | undefined;
    if (!specContent?.trim() && !planContent?.trim()) return;

    const demandTitle = (context?.demandTitle as string | undefined) ?? "feature";
    const featureDir = await this.resolveOrCreateFeatureDir(workspacePath, demandTitle);

    if (specContent?.trim()) {
      await writeFile(path.join(featureDir, "spec.md"), specContent, "utf-8");
    }
    if (planContent?.trim()) {
      await writeFile(path.join(featureDir, "plan.md"), planContent, "utf-8");
    }
  }

  /**
   * Reuses the feature directory `.specify/feature.json` already points at
   * if one exists (so re-syncing on a later execution doesn't fork into a
   * second feature dir) — creates `specs/001-<slug>/` the first time,
   * mirroring what `/speckit-specify` itself would persist to
   * `.specify/feature.json` per its own skill instructions.
   */
  private async resolveOrCreateFeatureDir(workspacePath: string, demandTitle: string): Promise<string> {
    const featureJsonPath = path.join(workspacePath, ".specify", "feature.json");
    try {
      const raw = await readFile(featureJsonPath, "utf-8");
      const parsed = JSON.parse(raw) as { feature_directory?: string };
      if (parsed.feature_directory) {
        const absolute = path.join(workspacePath, parsed.feature_directory);
        await mkdir(absolute, { recursive: true });
        return absolute;
      }
    } catch {
      // no feature.json yet (or unreadable/malformed) — create a fresh one below
    }

    const slug = slugify(demandTitle) || "feature";
    const relativeDir = `specs/001-${slug}`;
    const absoluteDir = path.join(workspacePath, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await mkdir(path.dirname(featureJsonPath), { recursive: true });
    await writeFile(featureJsonPath, JSON.stringify({ feature_directory: relativeDir }, null, 2), "utf-8");
    return absoluteDir;
  }

  private async pathExists(candidate: string): Promise<boolean> {
    try {
      await access(candidate);
      return true;
    } catch {
      return false;
    }
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

    // follow-up: `util.promisify(exec)`'s returned Promise has a `.child`
    // property (the real ChildProcess, documented Node behavior since
    // v15.4) available synchronously, before awaiting — captured here so
    // `cancel(executionId)` can kill this exact process later.
    const execPromise = execAsync(command, {
      cwd: input.workspacePath,
      timeout: this.timeoutMs,
      env,
    });
    const child = (execPromise as unknown as { child?: ChildProcess }).child;
    if (input.executionId && child) {
      this.activeProcesses.set(input.executionId, child);
    }

    try {
      const { stdout } = await execPromise;
      return stdout.trim();
    } catch (error) {
      const cause = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string | null;
        signal?: string | null;
        killed?: boolean;
      };
      if (cause.code === "ENOENT") {
        throw new Error(
          `SDD stage "${stageLabel}" failed: the "${this.claudeCommand}" CLI was not found on ` +
            "PATH for the worker process. Install and authenticate Claude Code where the " +
            "BullMQ worker runs.",
        );
      }
      // follow-up (live-validation finding): the previous message was just
      // `cause.message` (Node's own "Command failed: <cmd>\n<stderr>") with
      // `cause.stderr` appended AGAIN — duplicated the same unhelpful stderr
      // (often just a stdin warning) twice, and never surfaced WHY the
      // process actually died (timed out vs. crashed vs. a real non-zero
      // exit) — every failure looked identical and undiagnosable.
      // follow-up: on a non-zero exit, `--output-format json`'s actual error
      // explanation (auth/usage-limit/API errors) lands on STDOUT, not
      // stderr (stderr is usually only the harmless stdin warning) — a
      // real, live-observed failure ("exited with code 1") had nothing but
      // that warning in stderr, hiding the real reason entirely.
      const reason = cause.killed
        ? `killed by signal ${cause.signal ?? "unknown"} — likely hit the ${this.timeoutMs}ms timeout`
        : `exited with code ${cause.code ?? "unknown"}`;
      const stdoutDetail = cause.stdout?.trim();
      const stderrDetail = cause.stderr?.trim();
      const detail = [stdoutDetail, stderrDetail].filter(Boolean).join(" | ") || cause.message;
      throw new Error(`SDD stage "${stageLabel}" failed (${reason}): ${detail}`);
    } finally {
      if (input.executionId) this.activeProcesses.delete(input.executionId);
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
