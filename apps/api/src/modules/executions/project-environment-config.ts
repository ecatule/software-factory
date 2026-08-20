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

/**
 * An explicit, per-project exception: "this variable is known to look like a
 * real secret, but the project owner has decided it's fine for the
 * Developer Agent to see it as-is" — e.g. because there is no safe
 * homologation replacement to swap it for, and the risk was accepted
 * consciously rather than the check being silently bypassed. `reason` is
 * required so an allowlist entry always carries a human-readable
 * justification, matching this project's audit-everything posture even
 * though this specific decision isn't itself written to AuditLog (it's
 * treated the same as any other "this isn't actually production" signal
 * already baked into the guard, e.g. `localhost`).
 */
export interface AllowedSecretVariable {
  id: string;
  appliesToFiles: string[];
  variableName?: string;
  variableNameContains?: string;
  reason: string;
}

/**
 * Same idea as `AllowedSecretVariable`, but for the OTHER generic block —
 * a database connection string (`findUnsafeConnectionStringHost`) whose
 * host doesn't look local/dev/homologation. Some files (e.g.
 * `docker-compose.yml`) the project owner explicitly does not want this
 * guard rewriting (unlike `.env`, covered by a `SanitizationRule` instead),
 * so this only ever suppresses the block — it never modifies the file.
 */
export interface AllowedHost {
  id: string;
  appliesToFiles: string[];
  hostContains: string;
  reason: string;
}

interface ProjectEnvironmentConfig {
  rules?: SanitizationRule[];
  allowedSecrets?: AllowedSecretVariable[];
  allowedHosts?: AllowedHost[];
  /**
   * follow-up: `allowedSecrets`/`allowedHosts` require one entry per
   * variable/host as they're discovered — live-observed as recurring
   * whack-a-mole on `docker-compose.yml` for a project that has already
   * said, generally, "never touch this file" (7+ entries accumulated
   * before this existed). A basename listed here is skipped entirely by
   * BOTH `sanitizeRepositories` and `assertRepositoriesAreProductionSafe`
   * — no rewrite, no block, regardless of what the file contains. Only
   * meant for files the project owner has already decided are exempt as a
   * whole (e.g. a docker-compose.yml never touched by this platform to
   * begin with) — NOT a substitute for `allowedSecrets`/`allowedHosts` on
   * files that ARE otherwise sanitized/scanned.
   */
  excludedFiles?: string[];
  /**
   * feature 006 (spec FR-012/FR-013, research.md §5): a ÚNICA fonte de
   * verdade sobre "o que é homologação" para este Projeto, usada pelo
   * EnvironmentGuard (apps/api/src/modules/qa/environment-guard.service.ts)
   * — comparação determinística de string, nunca uma decisão da IA. Mesmo
   * arquivo/mecanismo já usado acima para produção, em vez de um mecanismo
   * paralelo (ex.: uma variável de ambiente global) — este projeto já é
   * multi-cliente, cada um com sua própria URL de homologação.
   */
  homologationEnvironment?: {
    applicationUrl?: string;
    apiUrl?: string;
  };
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

/** Returns [] when no config file exists for this project, or it has no `allowedSecrets` — the pre-implement gate falls back to blocking on every secret-looking value. */
export async function loadProjectAllowedSecrets(projectId: string): Promise<AllowedSecretVariable[]> {
  const filePath = path.join(PROJECT_ENV_CONFIG_DIR, `${projectId}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const config = JSON.parse(raw) as ProjectEnvironmentConfig;
  return config.allowedSecrets ?? [];
}

/** Returns [] when no config file exists for this project, or it has no `allowedHosts` — the pre-implement gate falls back to blocking on every unrecognized connection-string host. */
export async function loadProjectAllowedHosts(projectId: string): Promise<AllowedHost[]> {
  const filePath = path.join(PROJECT_ENV_CONFIG_DIR, `${projectId}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const config = JSON.parse(raw) as ProjectEnvironmentConfig;
  return config.allowedHosts ?? [];
}

/** Returns [] when no config file exists for this project, or it has no `excludedFiles` — every file is sanitized/scanned normally by default. */
export async function loadProjectExcludedFiles(projectId: string): Promise<string[]> {
  const filePath = path.join(PROJECT_ENV_CONFIG_DIR, `${projectId}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const config = JSON.parse(raw) as ProjectEnvironmentConfig;
  return config.excludedFiles ?? [];
}

/**
 * Returns `undefined` when no config file exists for this Project, OR when
 * it exists but is malformed/unreadable — `EnvironmentGuard` treats both
 * the same way, as "nothing configured" (deny by default, spec Edge Cases:
 * a Project that was never given a homologation config is not "authorized
 * by default", same as one with genuinely incomplete credentials). Unlike
 * the loaders above, this one deliberately catches a JSON parse failure too
 * — those loaders' callers already have their own separate block-by-default
 * fallback for a missing rule; this one is the ONLY signal EnvironmentGuard
 * has, so it must fail closed on its own.
 */
export async function loadProjectHomologationEnvironment(
  projectId: string,
): Promise<{ applicationUrl?: string; apiUrl?: string } | undefined> {
  const filePath = path.join(PROJECT_ENV_CONFIG_DIR, `${projectId}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }

  try {
    const config = JSON.parse(raw) as ProjectEnvironmentConfig;
    return config.homologationEnvironment;
  } catch {
    return undefined;
  }
}
