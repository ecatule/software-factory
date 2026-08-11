import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Security requirement: production/homologation environment data must
 * never live in Postgres (reachable through any HTTP endpoint to any
 * authenticated user with project-read access), in the git-tracked source
 * tree, or even in this config file as a literal production URL — real
 * production addresses don't follow one consistent shape across projects,
 * and the point of this file is to recognize/fix them without ever writing
 * one down. Instead, each rule describes production by generic markers
 * (a literal suffix like ".production", a company domain missing an "hml"
 * marker, a variable name fragment like "gateway") and a fixed,
 * non-sensitive homologation replacement value.
 *
 * One JSON file per Project, on the API server's own filesystem —
 * populated manually by whoever manages infrastructure, never written to
 * by the application itself. Resolved relative to this compiled file (not
 * `process.cwd()`), same reasoning as `WORKSPACE_ROOT` in
 * workspaces.service.ts. Override with `PROJECT_ENV_CONFIG_DIR` for
 * deployments where this file's location relative to the repo root differs.
 */
const PROJECT_ENV_CONFIG_DIR =
  process.env.PROJECT_ENV_CONFIG_DIR ??
  path.resolve(__dirname, "../../../../../project-environments");

/**
 * Matches one kind of variable across one or more files (e.g. `.env`'s
 * `GRAPHENEDB_BOLT_URL`, or any variable containing "gateway" in
 * `app-config.js`). `productionMarkers` are substrings that mean "this
 * value points at production" (e.g. ".production", "vexur.com.br") — a
 * bare public IP anywhere in the value counts too, checked in code, since
 * not every production host has a domain name. When a value matches and
 * isn't already exactly `replacement`, it's rewritten to `replacement`
 * verbatim — a fixed, pre-known homologation value, never derived from the
 * production value itself.
 *
 * follow-up: there used to be a `safeMarkers` field ("skip if the value
 * already contains e.g. 'hml'") — dropped because a value can look
 * homologation-ish without being the CORRECT homologation address (e.g.
 * "hml-api-gateway.vexur.com.br" isn't the canonical gateway URL configured
 * below). Exact-match against `replacement` is the only real "already
 * correct" signal.
 */
export interface SanitizationRule {
  id: string;
  appliesToFiles: string[];
  variableName?: string;
  variableNameContains?: string;
  /** Matches by the VALUE instead of the variable name — e.g. a gateway URL that shows up as `AUTH_ENDPOINT=https://api-gateway...`. */
  valueContains?: string;
  productionMarkers: string[];
  replacement: string;
}

interface ProjectEnvironmentConfig {
  rules?: SanitizationRule[];
}

/**
 * Returns [] when no config file exists for this project — not every
 * project has (or needs) one configured; the pre-implement safety gate
 * simply falls back to its generic block-only heuristics for those.
 */
export async function loadProjectSanitizationRules(projectId: string): Promise<SanitizationRule[]> {
  const filePath = path.join(PROJECT_ENV_CONFIG_DIR, `${projectId}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const config = JSON.parse(raw) as ProjectEnvironmentConfig;
  return config.rules ?? [];
}
