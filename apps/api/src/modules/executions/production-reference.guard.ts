import { exec } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { SECRET_LOOKING_KEY, SECRET_LOOKING_VALUE } from "../providers/secret-pattern.guard";
import type { AllowedHost, AllowedSecretVariable, SanitizationRule } from "./project-environment-config";

const execAsync = promisify(exec);

/**
 * Best-effort pre-implement safety net for cloned Artefato repositories,
 * run right after clone/checkout, before the Developer Agent is allowed to
 * edit them. Two layers, in order:
 *
 * 1. `sanitizeRepositories` — rewrites KNOWN production patterns (defined
 *    per Project in project-environment-config.ts) to a fixed, pre-known
 *    homologation value, in place, silently. Never logs the value it found
 *    or replaced — only which rule/file/variable was touched.
 * 2. `assertRepositoriesAreProductionSafe` — a generic fallback that BLOCKS
 *    the run for anything that still looks like production/a real secret
 *    and wasn't covered by an explicit rule above. Same "best-effort, not a
 *    guarantee" caveat as `secret-pattern.guard.ts`.
 */

const MAX_SCANNED_FILE_BYTES = 1_000_000; // config/env/docker files are always small

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".gz", ".tar",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".exe", ".dll", ".so",
  ".bin", ".class", ".jar", ".lock",
]);

const BINARY_CONTENT_MARKER = /\0/;

// user:pass@ is optional and stripped before the host capture group.
const DB_CONNECTION_STRING =
  /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|bolt|neo4j(?:\+s)?):\/\/(?:[^\s'"@]*@)?([a-zA-Z0-9.-]+)(?::\d+)?/gi;

// Hostnames/fragments expected in local/dev/homologation config — must never trip the block.
const SAFE_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
  "db", "postgres", "postgresql", "mysql", "mongo", "mongodb", "redis", "minio",
]);
// Substrings that, anywhere in a host, mark it as non-production — "hml"/"stage"
// are this codebase's own homologation markers (see project-environment-config.ts).
const SAFE_HOST_MARKERS = ["hml", "stage", "homolog"];

function isPrivateOrSafeHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (SAFE_HOSTS.has(lower)) return true;
  if (SAFE_HOST_MARKERS.some((marker) => lower.includes(marker))) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

// follow-up: real production hosts aren't always domain-based — some are
// bare IPs (e.g. a Neo4j/GraphenDB box addressed directly by IP, no DNS
// name at all), which no literal `productionMarkers` string could ever
// match. A public (non-private, non-localhost) IPv4 address anywhere in
// the value is treated as a production marker on its own, regardless of
// the rule's configured `productionMarkers` — same reasoning as the rest
// of this design: detect the general SHAPE of "this looks like a real
// external host", never enumerate specific known-bad addresses.
const IPV4_PATTERN = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

function containsPublicIp(value: string): boolean {
  const match = IPV4_PATTERN.exec(value);
  return match !== null && !isPrivateOrSafeHost(match[0]);
}

// key: value / key=value / "key": "value" — one line at a time, deliberately
// requiring BOTH the key and the value to look secret-shaped (unlike
// secret-pattern.guard.ts's OR, which validates a small trusted settings
// object) — scanning an entire arbitrary codebase with OR would flag every
// variable merely named "token" regardless of its value. The third group
// captures everything after the value verbatim (closing quote, trailing
// comma, comment, ...) so a rewrite never drops line punctuation.
const ASSIGNMENT_LINE = /^(\s*["']?[\w.-]+["']?\s*[:=]\s*["']?)([^\s"'#,;]+)(.*)$/;

export interface ProductionReferenceFinding {
  repoPath: string;
  filePath: string;
  reason: string;
}

export interface SanitizationChange {
  repoPath: string;
  filePath: string;
  ruleId: string;
  variableName: string;
}

/**
 * Rewrites every tracked file matching a rule's `appliesToFiles` + variable
 * name, replacing the value with the rule's fixed `replacement` whenever it
 * contains a production marker and no safe marker. Mutates files on disk;
 * intentionally never includes the matched/replaced value in its return
 * value or in any log — see project-environment-config.ts for why.
 */
export async function sanitizeRepositories(
  repoPaths: string[],
  rules: SanitizationRule[],
  excludedFiles: string[] = [],
): Promise<SanitizationChange[]> {
  if (rules.length === 0) return [];
  const changes: SanitizationChange[] = [];
  for (const repoPath of repoPaths) {
    changes.push(...(await sanitizeRepository(repoPath, rules, excludedFiles)));
  }
  return changes;
}

async function sanitizeRepository(
  repoPath: string,
  rules: SanitizationRule[],
  excludedFiles: string[],
): Promise<SanitizationChange[]> {
  const trackedFiles = await listTrackedFiles(repoPath);
  const changes: SanitizationChange[] = [];
  const excludedBasenames = new Set(excludedFiles.map((f) => f.toLowerCase()));

  for (const relativePath of trackedFiles) {
    const basename = path.basename(relativePath).toLowerCase();
    if (excludedBasenames.has(basename)) continue;
    const applicableRules = rules.filter((rule) =>
      rule.appliesToFiles.some((f) => f.toLowerCase() === basename),
    );
    if (applicableRules.length === 0) continue;

    const absolutePath = path.join(repoPath, relativePath);
    const content = await readTextFile(absolutePath);
    if (content === null) continue;

    // CRLF files (common — many of these are Windows-authored .env files):
    // splitting on a bare "\n" leaves a trailing "\r" on every line, which
    // silently broke every match below (`.` never matches a line
    // terminator — including "\r" — in JS regex, so `(.*)$` couldn't reach
    // end-of-string past it). Split on either, rejoin with whatever this
    // file actually used, so the rewritten file's line endings don't change.
    const usesCrlf = content.includes("\r\n");
    let modified = false;
    const lines = content.split(/\r\n|\n/);
    for (let i = 0; i < lines.length; i++) {
      const match = ASSIGNMENT_LINE.exec(lines[i]);
      if (!match) continue;
      const [, prefix, value, suffix] = match;
      const key = extractVariableName(lines[i]);
      if (!key) continue;

      const rule = applicableRules.find((r) => ruleMatches(r, key, value));
      if (!rule) continue;

      // follow-up: a value can contain a safe-looking marker (e.g. "hml") and
      // still be the WRONG homologation address — "hml-api-gateway.vexur.com.br"
      // still matched the "vexur.com.br" production marker, contained "hml",
      // and was (wrongly) skipped as "already safe". The only value that's
      // truly safe to leave alone is the exact configured `replacement`
      // itself — anything else matching a production marker gets normalized
      // to it, whether it looks production or merely looks homologation-ish
      // without being the canonical address.
      if (value === rule.replacement) continue;
      const lowerValue = value.toLowerCase();
      const hasProductionMarker =
        rule.productionMarkers.some((m) => lowerValue.includes(m.toLowerCase())) ||
        containsPublicIp(value);
      if (!hasProductionMarker) continue;

      lines[i] = `${prefix}${rule.replacement}${suffix}`;
      modified = true;
      changes.push({ repoPath, filePath: relativePath, ruleId: rule.id, variableName: key });
    }

    if (modified) {
      await writeFile(absolutePath, lines.join(usesCrlf ? "\r\n" : "\n"), "utf-8");
    }
  }

  return changes;
}

function extractVariableName(line: string): string | null {
  const match = /^\s*["']?([\w.-]+)["']?\s*[:=]/.exec(line);
  return match ? match[1] : null;
}

/**
 * follow-up: `valueContains` matches by the VALUE, not the variable name —
 * e.g. a real gateway URL showed up as `AUTH_ENDPOINT=https://api-gateway...`,
 * where "gateway" only appears in the value, never in the variable name.
 * `variableName`/`variableNameContains` still exist for rules that DO know
 * the exact variable name (e.g. `GRAPHENEDB_BOLT_URL`).
 */
function ruleMatches(rule: SanitizationRule, key: string, value: string): boolean {
  const lowerKey = key.toLowerCase();
  if (rule.variableName) return lowerKey === rule.variableName.toLowerCase();
  if (rule.variableNameContains) return lowerKey.includes(rule.variableNameContains.toLowerCase());
  if (rule.valueContains) return value.toLowerCase().includes(rule.valueContains.toLowerCase());
  return false;
}

/**
 * Generic fallback: throws if any tracked file in any of `repoPaths` still
 * looks like it references production (after `sanitizeRepositories` has
 * already fixed everything covered by an explicit rule) or contains a
 * real-looking secret. The thrown Error's message is persisted verbatim as
 * the AgentExecution's `error` by ExecutionsProcessor's existing catch-all.
 */
export async function assertRepositoriesAreProductionSafe(
  repoPaths: string[],
  allowedSecrets: AllowedSecretVariable[] = [],
  allowedHosts: AllowedHost[] = [],
  excludedFiles: string[] = [],
): Promise<void> {
  for (const repoPath of repoPaths) {
    const finding = await scanRepository(repoPath, allowedSecrets, allowedHosts, excludedFiles);
    if (finding) {
      throw new Error(
        `Pre-implement safety check failed — refusing to let the Developer Agent edit ` +
          `"${finding.repoPath}": ${finding.reason} in "${finding.filePath}".`,
      );
    }
  }
}

async function scanRepository(
  repoPath: string,
  allowedSecrets: AllowedSecretVariable[],
  allowedHosts: AllowedHost[],
  excludedFiles: string[],
): Promise<ProductionReferenceFinding | null> {
  const trackedFiles = await listTrackedFiles(repoPath);
  const excludedBasenames = new Set(excludedFiles.map((f) => f.toLowerCase()));

  for (const relativePath of trackedFiles) {
    if (BINARY_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) continue;

    const basename = path.basename(relativePath).toLowerCase();
    if (excludedBasenames.has(basename)) continue;

    const absolutePath = path.join(repoPath, relativePath);
    const content = await readTextFile(absolutePath);
    if (content === null) continue;

    const applicableHostAllowlist = allowedHosts.filter((entry) =>
      entry.appliesToFiles.some((f) => f.toLowerCase() === basename),
    );
    const unsafeHost = findUnsafeConnectionStringHost(content, applicableHostAllowlist);
    if (unsafeHost) {
      return {
        repoPath,
        filePath: relativePath,
        reason: `contains a database connection string pointing at "${unsafeHost}", which doesn't look like a local/dev/homologation host`,
      };
    }

    const applicableSecretAllowlist = allowedSecrets.filter((entry) =>
      entry.appliesToFiles.some((f) => f.toLowerCase() === basename),
    );
    const secretKey = findSecretLookingAssignment(content, applicableSecretAllowlist);
    if (secretKey) {
      return {
        repoPath,
        filePath: relativePath,
        reason: `contains a value that looks like a real secret (key "${secretKey}")`,
      };
    }
  }

  return null;
}

function isAllowedSecretVariable(key: string, allowlist: AllowedSecretVariable[]): boolean {
  const lowerKey = key.toLowerCase();
  return allowlist.some((entry) => {
    if (entry.variableName) return lowerKey === entry.variableName.toLowerCase();
    if (entry.variableNameContains) return lowerKey.includes(entry.variableNameContains.toLowerCase());
    return false;
  });
}

function isAllowedHost(host: string, allowlist: AllowedHost[]): boolean {
  const lowerHost = host.toLowerCase();
  return allowlist.some((entry) => lowerHost.includes(entry.hostContains.toLowerCase()));
}

async function listTrackedFiles(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync("git ls-files", { cwd: repoPath });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return []; // not a git repo (or git missing) — nothing to scan
  }
}

async function readTextFile(absolutePath: string): Promise<string | null> {
  let size: number;
  try {
    size = (await stat(absolutePath)).size;
  } catch {
    return null; // e.g. broken symlink
  }
  if (size > MAX_SCANNED_FILE_BYTES) return null;

  let content: string;
  try {
    content = await readFile(absolutePath, "utf-8");
  } catch {
    return null; // unreadable
  }
  return BINARY_CONTENT_MARKER.test(content) ? null : content;
}

function findUnsafeConnectionStringHost(content: string, allowlist: AllowedHost[]): string | null {
  const activeContent = stripCommentedLines(content);
  DB_CONNECTION_STRING.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DB_CONNECTION_STRING.exec(activeContent))) {
    const host = match[2];
    if (host && !isPrivateOrSafeHost(host) && !isAllowedHost(host, allowlist)) return host;
  }
  return null;
}

/**
 * follow-up (live-validation finding): a commented-out line
 * (`#GRAPHENEDB_BOLT_URL=bolt://neo4j-tecgroup.vexur.com.br:7687`, kept as a
 * dead/inactive reference alongside the real, already-sanitized value) still
 * contained a real production hostname and blocked implementation — the app
 * never reads a commented line, so this was a pure false positive. Blanks
 * out (not removes, to keep line/position offsets stable for future
 * callers) whichever comment style the line uses: "#" (.env/YAML/shell) or
 * "//" (JS/TS) — deliberately not handling C-style block comments, rare for
 * single-line secrets.
 */
function stripCommentedLines(content: string): string {
  return content
    .split(/\r\n|\n/)
    .map((line) => (/^\s*(#|\/\/)/.test(line) ? "" : line))
    .join("\n");
}

function findSecretLookingAssignment(
  content: string,
  allowlist: AllowedSecretVariable[],
): string | null {
  for (const line of content.split(/\r\n|\n/)) {
    const key = extractVariableName(line);
    const match = ASSIGNMENT_LINE.exec(line);
    if (!key || !match) continue;
    if (isAllowedSecretVariable(key, allowlist)) continue;
    const value = match[2];
    if (SECRET_LOOKING_KEY.test(key) && SECRET_LOOKING_VALUE.test(value)) return key;
  }
  return null;
}
