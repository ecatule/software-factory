import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactResult,
  ImplementationResult,
  SDDInput,
  SDDProvider,
} from "@software-factory/domain";

const execAsync = promisify(exec);

interface SpecKitConfig {
  /** CLI entrypoint used to drive Spec Kit inside a demand's workspace. */
  command?: string;
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

/**
 * spec FR-009: the only adapter that shells out to the Spec Kit CLI. Each
 * SDD stage runs `<command> <stage>` inside the demand's `spec/` directory
 * and reads back the document Spec Kit produced there.
 *
 * NOTE: requires the Spec Kit CLI to be installed and on PATH for the
 * BullMQ worker process — this is an infrastructure/deployment concern, not
 * something this adapter can satisfy on its own.
 */
export class SpecKitProvider implements SDDProvider {
  constructor(private readonly config: SpecKitConfig = {}) {}

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
    const command = this.config.command ?? "specify";
    const { stdout } = await execAsync(`${command} implement`, {
      cwd: input.workspacePath,
    });
    const filesChanged = stdout
      .split("\n")
      .filter((line) => line.trim().startsWith("modified:") || line.trim().startsWith("new file:"))
      .map((line) => line.split(":").slice(1).join(":").trim());
    return { filesChanged, summary: stdout.trim() };
  }

  private async runStage(
    stage: keyof typeof STAGE_TO_OUTPUT_FILE,
    input: SDDInput,
  ): Promise<ArtifactResult> {
    const command = this.config.command ?? "specify";
    await execAsync(`${command} ${stage}`, { cwd: input.workspacePath });

    const documentPath = path.join(input.workspacePath, "spec", STAGE_TO_OUTPUT_FILE[stage]);
    const content = await readFile(documentPath, "utf-8");
    return { documentPath, content };
  }
}
