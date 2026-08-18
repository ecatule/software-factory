import { Node, SyntaxKind, type FunctionExpression, type ArrowFunction } from "ts-morph";
import type { ParsedSource } from "../scanner/source-parser";
import type { RequiredModule } from "./import-resolver";

export interface MethodCallDependency {
  callerSymbol: string;
  calleeObject: string;
  calleeMethod: string;
  sourceFile: string;
  sourceLine: number;
}

/**
 * spec CA04 "Controller → Service": within each EXPORTED function in a file
 * (the dominant convention in this platform's backend repos —
 * `exports.obterMarcacoes = async function (req, res, next) { ... }`, plain
 * CommonJS, not ES `export function`), finds calls into other locally
 * `require`d modules' methods (e.g. `business.obterMarcacoes(...)`).
 * `requiredModules` — pass the same `findRequiredModules(sourceFile)` result
 * the caller already needs for handler/import resolution, so it's computed
 * once per file, not per call site.
 */
export function detectMethodCalls(
  parsed: ParsedSource,
  requiredModules: RequiredModule[],
): MethodCallDependency[] {
  if (requiredModules.length === 0) return [];
  const localModuleNames = new Set(requiredModules.map((m) => m.localName));
  const results: MethodCallDependency[] = [];

  for (const call of parsed.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) continue;

    const calleeObject = expression.getExpression().getText();
    if (!localModuleNames.has(calleeObject)) continue;

    const callerSymbol = findEnclosingExportedFunctionName(call);
    if (!callerSymbol) continue;

    results.push({
      callerSymbol,
      calleeObject,
      calleeMethod: expression.getName(),
      sourceFile: parsed.originalFilePath,
      sourceLine: parsed.lineOffset + call.getStartLineNumber(),
    });
  }

  return results;
}

/**
 * Walks up to the nearest enclosing function, then checks whether THAT
 * function is the right-hand side of `exports.<name> = function ...` or
 * `module.exports.<name> = function ...` — CommonJS's equivalent of a named
 * export. Returns `null` for calls not inside any exported function (e.g.
 * a private top-level helper never assigned to `exports`). Exported so
 * `detectHttpCalls` results can also be attributed to the right
 * Controller/Service node when run against backend files, not just
 * `detectMethodCalls` — same resolution, same convention either way.
 */
export function findEnclosingExportedFunctionName(node: Node): string | null {
  const fn =
    node.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ??
    node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ??
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (!fn) return null;

  if (Node.isFunctionDeclaration(fn)) return fn.getName() ?? null;

  const parent = (fn as FunctionExpression | ArrowFunction).getParent();
  if (!Node.isBinaryExpression(parent)) return null;
  const left = parent.getLeft();
  if (!Node.isPropertyAccessExpression(left)) return null;

  const target = left.getExpression().getText();
  if (target !== "exports" && target !== "module.exports") return null;
  return left.getName();
}
