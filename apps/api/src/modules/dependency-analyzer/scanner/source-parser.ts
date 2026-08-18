import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseVueSfc } from "@vue/compiler-sfc";
import { Project, type SourceFile } from "ts-morph";

/**
 * A parsed source file ready for AST analysis, plus enough metadata to
 * report evidence (file/line) against the ORIGINAL file on disk — for
 * `.vue` files the analyzable code is the extracted `<script>` block, whose
 * line numbers are offset from the real file (see `lineOffset`).
 */
export interface ParsedSource {
  /** absolute path of the real file on disk (never the virtual .vue-script one). */
  originalFilePath: string;
  sourceFile: SourceFile;
  /** add to a ts-morph-reported line number to get the real line in `originalFilePath`. 0 for plain JS/TS files. */
  lineOffset: number;
}

/**
 * spec §"o parser seria escolhido conforme a extensão/tipo do arquivo":
 * `.ts`/`.tsx`/`.js`/`.jsx` go into ts-morph directly; `.vue` is a Single
 * File Component — its `<script>`/`<script setup>` block is extracted via
 * `@vue/compiler-sfc` first, then that extracted code is what actually gets
 * parsed by ts-morph (Vue's own template syntax is not TS/JS and isn't
 * analyzed by this parser). A `.vue` file with no `<script>` block yields
 * `null` — nothing to analyze (e.g. a pure-template partial).
 */
export async function parseSourceFile(
  project: Project,
  filePath: string,
): Promise<ParsedSource | null> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".vue") {
    return parseVueFile(project, filePath);
  }
  const content = await readFile(filePath, "utf-8");
  const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  return { originalFilePath: filePath, sourceFile, lineOffset: 0 };
}

async function parseVueFile(project: Project, filePath: string): Promise<ParsedSource | null> {
  const content = await readFile(filePath, "utf-8");
  const { descriptor } = parseVueSfc(content, { filename: filePath });
  const script = descriptor.scriptSetup ?? descriptor.script;
  if (!script) return null;

  const lang = script.lang === "ts" || script.lang === "tsx" ? script.lang : "js";
  // virtual path — never written to disk, just gives ts-morph the right
  // extension so it parses TS syntax (or not) correctly.
  const virtualPath = `${filePath}.__script__.${lang}`;
  const sourceFile = project.createSourceFile(virtualPath, script.content, { overwrite: true });
  return { originalFilePath: filePath, sourceFile, lineOffset: script.loc.start.line - 1 };
}
