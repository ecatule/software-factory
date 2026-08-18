import { Node, SyntaxKind } from "ts-morph";
import type { ParsedSource } from "../scanner/source-parser";

export interface BackendRoute {
  method: string;
  routePath: string;
  /** the handler's object name, e.g. "controller" out of `controller.obterMarcacoes` — used to resolve the handler's file via `require`/imports. */
  handlerObject: string | null;
  handlerSymbol: string | null;
  sourceFile: string;
  sourceLine: number;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
// spec §4.5/§10 "Extractor de Backend": `app.<method>(...)` (plain Express,
// live-observed as the actual pattern used) and `router.<method>(...)`
// (Express Router / Fastify shorthand methods share this exact shape).
const ROUTER_IDENTIFIERS = new Set(["app", "router", "route"]);

/**
 * spec §4.5/§10: detects `app.get('/path', ...middleware, handler)` style
 * route registrations. The path is always the first argument (a string
 * literal here, or the route wouldn't be reachable at all — unlike HTTP call
 * sites there's no dynamic-URL/LOW-confidence case to model). The handler is
 * taken as the LAST argument — real code often threads one or more
 * middleware functions (`controller.autorizar`) before it.
 */
export function detectBackendRoutes(parsed: ParsedSource): BackendRoute[] {
  const results: BackendRoute[] = [];

  for (const call of parsed.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) continue;

    const routerName = expression.getExpression().getText();
    const methodName = expression.getName().toLowerCase();
    if (!ROUTER_IDENTIFIERS.has(routerName) || !HTTP_METHODS.has(methodName)) continue;

    const args = call.getArguments();
    const [pathArg] = args;
    if (!pathArg || !Node.isStringLiteral(pathArg)) continue;
    const handler = args[args.length - 1];

    results.push({
      method: methodName.toUpperCase(),
      routePath: pathArg.getLiteralValue(),
      handlerObject: handlerObjectName(handler),
      handlerSymbol: handlerSymbolName(handler),
      sourceFile: parsed.originalFilePath,
      sourceLine: parsed.lineOffset + call.getStartLineNumber(),
    });
  }

  return results;
}

function handlerObjectName(handler: Node | undefined): string | null {
  if (handler && Node.isPropertyAccessExpression(handler)) {
    return handler.getExpression().getText();
  }
  return null;
}

function handlerSymbolName(handler: Node | undefined): string | null {
  if (!handler) return null;
  if (Node.isPropertyAccessExpression(handler)) return handler.getName();
  if (Node.isIdentifier(handler)) return handler.getText();
  return null;
}
