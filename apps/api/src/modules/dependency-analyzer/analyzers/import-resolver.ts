import { existsSync } from "node:fs";
import path from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

/**
 * spec §"resolução cross-file": collects both static `import X from '...'`
 * declarations AND dynamic `import('...')` calls — the latter is NOT a
 * corner case here. Live-observed in the real Vexur/Vue repository this
 * feature was validated against: every sub-component is registered as a
 * lazy-loaded dynamic import inside Vue's `components: { ... }` option
 * (`AditivoFinanceiro: () => import("./VexurFaturamentoAditivoFinanceiro.vue")`),
 * never a static import — `getImportDeclarations()` alone finds nothing.
 * Only relative (`./`, `../`) and `@/`-aliased specifiers are returned;
 * bare package specifiers (`"vue"`, `"axios"`, ...) are filtered out here
 * since they're never local files to keep walking into.
 */
export function findLocalImportSpecifiers(sourceFile: SourceFile): string[] {
  const specifiers = new Set<string>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    specifiers.add(declaration.getModuleSpecifierValue());
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const [arg] = call.getArguments();
    if (arg && Node.isStringLiteral(arg)) {
      specifiers.add(arg.getLiteralValue());
    }
  }

  return [...specifiers].filter((s) => s.startsWith(".") || s.startsWith("@/"));
}

export interface RequiredModule {
  /** the local binding the module was assigned to, e.g. "controller" in `const controller = require('./scripts/controller.js')`. */
  localName: string;
  specifier: string;
}

/**
 * Node.js backend repos in this platform use plain CommonJS
 * (`const controller = require('./scripts/controller.js')`), not ES
 * imports — live-observed in the real Express repo this analyzer targets.
 * Only top-level `const/let/var x = require('...')` bindings are collected
 * (covers the overwhelming majority of real code); destructured requires
 * (`const { a } = require(...)`) are deliberately not resolved to a single
 * local name and are skipped.
 */
export function findRequiredModules(sourceFile: SourceFile): RequiredModule[] {
  const modules: RequiredModule[] = [];
  for (const decl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = decl.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) continue;
    const callee = initializer.getExpression();
    if (!Node.isIdentifier(callee) || callee.getText() !== "require") continue;
    const [arg] = initializer.getArguments();
    if (!arg || !Node.isStringLiteral(arg)) continue;
    const nameNode = decl.getNameNode();
    if (!Node.isIdentifier(nameNode)) continue;
    modules.push({ localName: nameNode.getText(), specifier: arg.getLiteralValue() });
  }
  return modules;
}

const RESOLVABLE_EXTENSIONS = ["", ".vue", ".ts", ".tsx", ".js", ".jsx"];
const INDEX_EXTENSIONS = [".vue", ".ts", ".tsx", ".js", ".jsx"];

/**
 * Resolves a relative or `@/`-aliased (common Vue/React convention for
 * `<repositoryRoot>/src/`) specifier to a real file on disk, trying each
 * extension in turn and falling back to `<dir>/index.*` for directory
 * imports. Returns `null` when nothing resolves, or when resolution would
 * escape `repositoryRoot` (never follow an import outside the analyzed repo).
 */
export function resolveImportPath(
  fromFile: string,
  specifier: string,
  repositoryRoot: string,
): string | null {
  const basePath = specifier.startsWith("@/")
    ? path.join(repositoryRoot, "src", specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = basePath + extension;
    if (existsSync(candidate)) return withinRoot(candidate, repositoryRoot);
  }
  for (const extension of INDEX_EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`);
    if (existsSync(candidate)) return withinRoot(candidate, repositoryRoot);
  }
  return null;
}

/**
 * Normalizes to forward slashes before returning — `fast-glob` (used for the
 * initial file discovery list, see `file-discovery.ts`) always returns
 * forward-slash paths even on Windows, while `path.resolve`/`path.join`
 * here produce backslash paths. Without normalizing, a resolved import would
 * never string-match its own entry in the discovery list — breaking both the
 * `parsedCache` (re-parsing the same file under two different keys) and any
 * `Set`-based dedup keyed on file path (e.g. `screenReachableFiles` in
 * `dependency-analyzer.service.ts`).
 */
function withinRoot(candidate: string, repositoryRoot: string): string | null {
  const relative = path.relative(repositoryRoot, candidate);
  return relative.startsWith("..") ? null : candidate.split(path.sep).join("/");
}
