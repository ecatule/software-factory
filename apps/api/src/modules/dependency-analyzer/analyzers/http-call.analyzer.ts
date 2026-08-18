import { Node, SyntaxKind } from "ts-morph";
import type { ParsedSource } from "../scanner/source-parser";
import { findEnclosingExportedFunctionName } from "./method-call.analyzer";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface HttpDependency {
  method: string;
  url: string;
  sourceFile: string;
  sourceLine: number;
  sourceSymbol?: string;
  confidence: Confidence;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
// common client-wrapper identifiers seen in real projects: axios itself,
// generic in-house wrapper names ("api"/"http"/"request"), and Vue's classic
// `this.$http`/`this.$axios`/`this.$api` plugin-injection convention
// (vue-resource/axios installed onto Vue.prototype — live-observed: this is
// the ONLY pattern the real Vexur/Vue repo this feature was validated
// against actually uses, `this.$http.post(...)` everywhere).
const CLIENT_IDENTIFIERS = new Set([
  "axios",
  "api",
  "http",
  "request",
  "$http",
  "$axios",
  "$api",
  "$request",
]);

/**
 * spec §4.4 "Identificação de chamadas HTTP": detects `axios`/wrapper-style
 * calls (`axios.get(...)`, `api.post(...)`) and bare `fetch(...)`. Confidence
 * is HIGH when the URL is a string literal, LOW when it's built dynamically
 * (template literal, variable, concatenation) — same rule the spec gives as
 * its own example (`` api.get(`${baseUrl}/${resource}`) `` → LOW).
 */
export function detectHttpCalls(parsed: ParsedSource): HttpDependency[] {
  const results: HttpDependency[] = [];
  const calls = parsed.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of calls) {
    const expression = call.getExpression();

    if (Node.isPropertyAccessExpression(expression)) {
      // the rightmost segment right before the method name — e.g. "$http"
      // out of `this.$http.post(...)`, "axios" out of `axios.get(...)`.
      // Using the FULL text of everything before `.post` (e.g. "this.$http")
      // would never match a fixed identifier set; only the last segment is
      // the actual client name regardless of how deeply nested the access is.
      const clientName = getClientName(expression.getExpression());
      const methodName = expression.getName().toLowerCase();
      if (!clientName || !CLIENT_IDENTIFIERS.has(clientName) || !HTTP_METHODS.has(methodName)) continue;
      const [urlArg] = call.getArguments();
      const { url, confidence } = resolveUrlArgument(urlArg);
      results.push({
        method: methodName.toUpperCase(),
        url,
        sourceFile: parsed.originalFilePath,
        sourceLine: parsed.lineOffset + call.getStartLineNumber(),
        // deferred until here — this ancestor walk is real work (doubly so
        // now it can fall through to `findEnclosingExportedFunctionName`),
        // not worth paying for every CallExpression in the file when the
        // overwhelming majority are never going to be an HTTP call at all.
        sourceSymbol: findEnclosingSymbolName(call),
        confidence,
      });
      continue;
    }

    if (Node.isIdentifier(expression) && expression.getText() === "fetch") {
      const [urlArg, optionsArg] = call.getArguments();
      const { url, confidence } = resolveUrlArgument(urlArg);
      results.push({
        method: resolveFetchMethod(optionsArg),
        url,
        sourceFile: parsed.originalFilePath,
        sourceLine: parsed.lineOffset + call.getStartLineNumber(),
        sourceSymbol: findEnclosingSymbolName(call),
        confidence,
      });
    }
  }

  return results;
}

function getClientName(expr: Node): string | null {
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return null;
}

/**
 * Live-observed gap: real call sites often build the URL into a local
 * variable first (`let url = \`${base}/api-x/upload\`; ... client.post(url, ...)`)
 * instead of inlining it at the call — the bare-Identifier fallback below
 * used to just return the variable's NAME ("url"), throwing away the one
 * thing that actually identifies which API is being called. When the
 * argument is an Identifier, resolve it back to its declaration's
 * initializer (one hop, no reassignment tracking — proportional to what's
 * needed to recover the meaningful part, a later `url = url + "?query"`
 * reassignment is not followed) and evaluate THAT instead.
 */
function resolveUrlArgument(arg: Node | undefined): { url: string; confidence: Confidence } {
  if (!arg) return { url: "(desconhecida)", confidence: "LOW" };
  if (Node.isStringLiteral(arg)) {
    return { url: arg.getLiteralValue(), confidence: "HIGH" };
  }
  if (Node.isIdentifier(arg)) {
    const initializer = resolveIdentifierInitializer(arg);
    if (initializer) return resolveUrlArgument(initializer);
  }
  return { url: arg.getText(), confidence: "LOW" };
}

function resolveIdentifierInitializer(identifier: Node): Node | undefined {
  const declaration = identifier
    .getSymbol()
    ?.getDeclarations()
    .find((d): d is import("ts-morph").VariableDeclaration => Node.isVariableDeclaration(d));
  return declaration?.getInitializer();
}

function resolveFetchMethod(optionsArg: Node | undefined): string {
  if (!optionsArg || !Node.isObjectLiteralExpression(optionsArg)) return "GET";
  const methodProp = optionsArg.getProperty("method");
  if (
    methodProp &&
    Node.isPropertyAssignment(methodProp) &&
    Node.isStringLiteral(methodProp.getInitializerOrThrow())
  ) {
    return (methodProp.getInitializerOrThrow() as import("ts-morph").StringLiteral)
      .getLiteralValue()
      .toUpperCase();
  }
  return "GET";
}

/**
 * Best-effort "which function/method is this call inside" — for evidence
 * (`sourceSymbol`), and, when this file turns out to be reachable from a
 * backend Controller/Service (spec §4.10 "API → API"), for resolving WHICH
 * exported function is the actual caller. Handles: class methods, named
 * function declarations, an arrow function bound to a const/property, and
 * (via `findEnclosingExportedFunctionName`) CommonJS's
 * `exports.X = function ...`/`module.exports.X = function ...` — the
 * dominant convention in this platform's Node.js backend repos, where the
 * first three cases never match at all. Undefined when the call sits in
 * top-level module code, outside any function.
 */
function findEnclosingSymbolName(node: Node): string | undefined {
  const fn =
    node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
  if (fn) {
    if (Node.isMethodDeclaration(fn) || Node.isFunctionDeclaration(fn)) {
      return fn.getName();
    }
    // arrow function assigned to a const/property — use the variable/property name it's bound to.
    const parent = fn.getParent();
    if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
      const name = parent.getName?.();
      if (name) return name;
    }
  }
  return findEnclosingExportedFunctionName(node) ?? undefined;
}
