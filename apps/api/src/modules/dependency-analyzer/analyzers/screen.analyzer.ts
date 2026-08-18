import path from "node:path";
import { SyntaxKind } from "ts-morph";
import type { ParsedSource } from "../scanner/source-parser";

export interface ScreenCandidate {
  name: string;
  filePath: string;
  line: number;
}

const SCREEN_DIRECTORY_PATTERN = /(?:^|[\\/])(pages|screens|views)(?:[\\/]|$)/i;
// live-observed (Vexur/Vue repos): no pages/screens/views at all — each
// feature gets its own `components/<Nome>/` folder with an `index.vue` as
// the entry point; siblings in that same folder are sub-components of it,
// not screens of their own (e.g. `components/Modals/AlertaModal.vue` has no
// index.vue next to it — correctly NOT a screen).
const COMPONENT_INDEX_PATTERN = /(?:^|[\\/])components[\\/]([^\\/]+)[\\/]index\.vue$/i;

/**
 * spec §4.3 "Identificação de telas": heuristic MVP, two conventions:
 * 1. `pages/`/`screens/`/`views/` directory (what the spec suggests first).
 *    A React/plain-TS file also needs a detectable default export to count
 *    (rules out barrel/helper files sitting in the same folder); a `.vue`
 *    SFC counts on directory alone — Options API SFCs export default
 *    implicitly and `<script setup>` has no export statement at all.
 * 2. `components/<Nome>/index.vue` — no pages/screens/views folder at all,
 *    but each top-level feature lives in its own named subfolder with an
 *    `index.vue` entry point; the screen's name is the FOLDER name, not the
 *    literal "index".
 */
export function detectScreen(parsed: ParsedSource): ScreenCandidate | null {
  const componentIndexMatch = parsed.originalFilePath.match(COMPONENT_INDEX_PATTERN);
  if (componentIndexMatch) {
    return { name: componentIndexMatch[1], filePath: parsed.originalFilePath, line: parsed.lineOffset + 1 };
  }

  if (!SCREEN_DIRECTORY_PATTERN.test(parsed.originalFilePath)) return null;

  const isVue = parsed.originalFilePath.toLowerCase().endsWith(".vue");
  if (!isVue && !hasDefaultExport(parsed)) return null;

  const name = path.basename(parsed.originalFilePath).replace(/\.(vue|tsx?|jsx?)$/i, "");
  return { name, filePath: parsed.originalFilePath, line: parsed.lineOffset + 1 };
}

function hasDefaultExport(parsed: ParsedSource): boolean {
  const sourceFile = parsed.sourceFile;
  if (sourceFile.getDefaultExportSymbol()) return true;
  // `export default { ... }` (Vue Options API extracted script) and
  // `export default function/class` without a named declaration both show
  // up as an ExportAssignment node rather than a default-export symbol.
  return sourceFile.getDescendantsOfKind(SyntaxKind.ExportAssignment).length > 0;
}
