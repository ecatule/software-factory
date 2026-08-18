import { rm } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CODE_REPOSITORY_PROVIDER, type CodeRepositoryProvider } from "@software-factory/domain";
import { Project } from "ts-morph";
import { PrismaService } from "../../common/prisma/prisma.service";
import { composeOwnerRepo } from "../executions/repository-reference";
import { WORKSPACE_ROOT } from "../workspaces/workspaces.service";
import { discoverSourceFiles } from "./scanner/file-discovery";
import { parseSourceFile, type ParsedSource } from "./scanner/source-parser";
import { detectScreen } from "./analyzers/screen.analyzer";
import { detectHttpCalls } from "./analyzers/http-call.analyzer";
import { detectBackendRoutes } from "./analyzers/backend-route.analyzer";
import { detectMethodCalls } from "./analyzers/method-call.analyzer";
import {
  findLocalImportSpecifiers,
  findRequiredModules,
  resolveImportPath,
  type RequiredModule,
} from "./analyzers/import-resolver";
import { Neo4jDependencyRepository, type RelatedRepositoryCall } from "./neo4j-dependency.repository";

/** BFS depth cap when following a Screen's imports (spec §27 — bound the work, avoid pathological/cyclic import graphs). */
const MAX_IMPORT_DEPTH = 5;

export interface AnalysisSummary {
  repositoryId: string;
  filesScanned: number;
  filesParsed: number;
  screensFound: number;
  apiCallsFound: number;
  backendRoutesFound: number;
  methodCallsFound: number;
}

export interface RelatedSystemArtifact {
  method: string;
  url: string;
  repositoryId: string;
  systemArtifactId: string | null;
  systemArtifactName: string | null;
  systemArtifactType: string | null;
  systemId: string | null;
}

/**
 * spec (Mapa de Dependências) §31 "Fase 3/4/5": Frontend → API (Screen
 * detection + HTTP call evidence, cross-file) and Backend route → Controller
 * detection (CA03). DB/Redis/RabbitMQ extractors and the CLI are later
 * phases, deliberately out of scope here.
 *
 * HTTP calls are attributed to a Screen from its own file AND from every
 * local file it imports (directly or transitively, up to
 * `MAX_IMPORT_DEPTH`) — both static `import` and dynamic `import(...)`
 * (live-observed: Vue's lazy `components: { X: () => import('./X.vue') }`
 * pattern is the norm in real repos, not a corner case). Evidence keeps the
 * REAL file/line the call was found in, even when that's a sub-component
 * file, not the Screen's own — more traceable than attributing it to the
 * Screen's file.
 */
@Injectable()
export class DependencyAnalyzerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly neo4j: Neo4jDependencyRepository,
    @Inject(CODE_REPOSITORY_PROVIDER)
    private readonly codeRepositoryProvider: CodeRepositoryProvider,
  ) {}

  /**
   * Triggered from the "Artefatos" table on a Sistema's detail screen (one
   * clone per run, always deleted afterward — see `finally` below) rather
   * than the old CLI-only, persistent-clone flow. Resolves via
   * `SystemArtifact`/`SystemArtifactRepository` — the reusable catalog of a
   * system's real artifacts ("artefatos ativos do sistema"), NOT the
   * demand-scoped `Artifact`/`ArtifactRepository` (a per-demand working
   * copy). `branch` is a snapshot of the global
   * `DependencyAnalyzerSettings.defaultBranch` at trigger time (see
   * `DependencyAnalysisRunsService`) — read-only checkout, never committed
   * to or pushed (this module never calls `commit`/`push`). `runId` scopes
   * the clone directory so concurrent runs (different artifacts) never
   * collide, and doubles as the correlation id for `onProgress`.
   */
  async analyzeArtifact(
    systemArtifactId: string,
    branch: string,
    runId: string,
    onProgress?: (stage: string) => Promise<void>,
  ): Promise<AnalysisSummary> {
    const { externalReference, name } = await this.resolveSystemArtifactReference(systemArtifactId);
    const targetPath = this.resolveAnalysisClonePath(runId);

    try {
      await onProgress?.("cloning");
      await this.ensureCloned(externalReference, targetPath, branch);
      await onProgress?.("analyzing");
      return await this.scanAndPersist(externalReference, name, targetPath);
    } finally {
      await onProgress?.("cleanup");
      await rm(targetPath, { recursive: true, force: true });
    }
  }

  private async scanAndPersist(
    externalReference: string,
    artifactName: string,
    targetPath: string,
  ): Promise<AnalysisSummary> {
    await this.neo4j.ensureConstraints();
    await this.neo4j.upsertRepository(externalReference, artifactName);

    const files = await discoverSourceFiles(targetPath);
    // `allowJs` — without it, ts-morph never binds symbols for plain .js
    // files (`identifier.getSymbol()` silently returns undefined), which
    // breaks local-variable resolution in http-call.analyzer.ts's
    // `resolveUrlArgument` for the common `let url = \`...\`; client.post(url)`
    // pattern (live-observed: real backend repos here are plain JS, not TS).
    const project = new Project({
      useInMemoryFileSystem: false,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });

    // shared across every screen — a sub-component imported by several
    // screens (e.g. a shared Modal) is parsed once, not once per screen.
    const parsedCache = new Map<string, ParsedSource | null>();
    const getParsed = async (filePath: string): Promise<ParsedSource | null> => {
      if (parsedCache.has(filePath)) return parsedCache.get(filePath) ?? null;
      const parsed = await parseSourceFile(project, filePath);
      parsedCache.set(filePath, parsed);
      return parsed;
    };

    let filesParsed = 0;
    let screensFound = 0;
    let apiCallsFound = 0;
    const screens: Array<{ screenId: string; parsed: ParsedSource }> = [];

    for (const file of files) {
      const parsed = await getParsed(file);
      if (!parsed) continue;
      filesParsed += 1;

      const screen = detectScreen(parsed);
      if (!screen) continue;
      screensFound += 1;

      const screenId = `repo:${externalReference}|file:${path.relative(targetPath, screen.filePath)}|symbol:${screen.name}`;
      await this.neo4j.upsertScreen({
        id: screenId,
        name: screen.name,
        filePath: path.relative(targetPath, screen.filePath),
        line: screen.line,
        repositoryId: externalReference,
      });
      screens.push({ screenId, parsed });
    }

    // Second pass: for each screen, walk its local import graph (own file +
    // everything it pulls in, static or dynamic `import()`, up to
    // MAX_IMPORT_DEPTH) and attribute every HTTP call found along the way.
    // tracks every file reached from ANY screen (own file + imported
    // sub-components) — the third pass below re-scans every file in the repo
    // for API→API calls, and without this it would also re-detect calls
    // already attributed to a Screen here (a Vue `methods: { foo() {...} }`
    // entry is itself a MethodDeclaration, so it matches the third pass's
    // "exported function" caller-resolution too), producing a duplicate,
    // label-less orphan node disconnected from the Repository/Screen instead
    // of the one real call already correctly attached via CONTAINS.
    const screenReachableFiles = new Set<string>();

    for (const { screenId, parsed: screenParsed } of screens) {
      const visited = new Set<string>();
      const queue: Array<{ parsed: ParsedSource; depth: number }> = [{ parsed: screenParsed, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.parsed.originalFilePath)) continue;
        visited.add(current.parsed.originalFilePath);
        screenReachableFiles.add(current.parsed.originalFilePath);

        const httpCalls = detectHttpCalls(current.parsed);
        for (const call of httpCalls) {
          apiCallsFound += 1;
          await this.neo4j.upsertApiCall({
            callerId: screenId,
            method: call.method,
            url: call.url,
            sourceFile: path.relative(targetPath, call.sourceFile),
            sourceLine: call.sourceLine,
            sourceSymbol: call.sourceSymbol,
            confidence: call.confidence,
          });
        }

        if (current.depth >= MAX_IMPORT_DEPTH) continue;
        for (const specifier of findLocalImportSpecifiers(current.parsed.sourceFile)) {
          const resolved = resolveImportPath(current.parsed.originalFilePath, specifier, targetPath);
          if (!resolved || visited.has(resolved)) continue;
          const childParsed = await getParsed(resolved);
          if (childParsed) queue.push({ parsed: childParsed, depth: current.depth + 1 });
        }
      }
    }

    // Third pass: backend route registrations (`app.get('/path', ...,
    // handler)`, CA03) and method-to-method calls into other local `require`d
    // modules (`business.obterMarcacoes(...)`, CA04 "Controller → Service")
    // — independent of the Screen/import-graph walk above, every parsed file
    // is checked directly. Reuses the same `parsedCache` and, per file, the
    // same `requiredModules` lookup for both route-handler AND method-call
    // resolution — computed once, not once per call site.
    const buildNodeId = (filePath: string, symbol: string) =>
      `repo:${externalReference}|file:${path.relative(targetPath, filePath)}|symbol:${symbol}`;

    let backendRoutesFound = 0;
    let methodCallsFound = 0;
    for (const file of files) {
      const parsed = await getParsed(file);
      if (!parsed) continue;
      const requiredModules = findRequiredModules(parsed.sourceFile);

      const routes = detectBackendRoutes(parsed);
      for (const route of routes) {
        backendRoutesFound += 1;
        const controllerFile = this.resolveLocalCallTarget(
          route.handlerObject,
          parsed.originalFilePath,
          requiredModules,
          targetPath,
        );
        const controllerId =
          controllerFile && route.handlerSymbol ? buildNodeId(controllerFile, route.handlerSymbol) : null;
        await this.neo4j.upsertBackendRoute({
          method: route.method,
          routePath: route.routePath,
          repositoryId: externalReference,
          controllerId,
          controllerName: controllerId ? route.handlerSymbol : null,
          sourceFile: path.relative(targetPath, route.sourceFile),
          sourceLine: route.sourceLine,
        });
      }

      if (requiredModules.length > 0) {
        for (const call of detectMethodCalls(parsed, requiredModules)) {
          const calleeFile = this.resolveLocalCallTarget(
            call.calleeObject,
            parsed.originalFilePath,
            requiredModules,
            targetPath,
          );
          if (!calleeFile) continue;
          methodCallsFound += 1;
          await this.neo4j.upsertMethodCall({
            callerId: buildNodeId(parsed.originalFilePath, call.callerSymbol),
            calleeId: buildNodeId(calleeFile, call.calleeMethod),
            calleeName: call.calleeMethod,
            sourceFile: path.relative(targetPath, call.sourceFile),
            sourceLine: call.sourceLine,
          });
        }
      }

      // spec §4.10/§10 "API → API": the SAME HTTP-call detector used for
      // Screens, run against backend files too — a Service/Controller
      // calling another API is `upsertApiCall` with that function's node id
      // as the caller (`call.sourceSymbol`, now resolved for CommonJS
      // `exports.X = function` too — see http-call.analyzer.ts). No new
      // detection logic; only the caller-resolution differs from a Screen.
      // Two guards keep this scoped to actual backend files, not frontend
      // component files re-processed here by accident:
      //  - `screenReachableFiles`: skip files already reached from a Screen
      //    (own file or an import) — those calls are already correctly
      //    attributed there via CONTAINS; re-scanning here would only
      //    create a duplicate, disconnected node for the same call.
      //  - `requiredModules.length > 0`: this platform's backend repos use
      //    CommonJS `require` (see `findRequiredModules`'s own doc-comment);
      //    frontend Vue/React files never do. Without this, ANY object
      //    literal method (e.g. Vue's `methods: { foo() {...} }`, which
      //    `findEnclosingSymbolName` also resolves a name for) in a
      //    Screen-unreachable component would still produce a
      //    `sourceSymbol` and get treated as a backend API→API call.
      if (screenReachableFiles.has(parsed.originalFilePath)) continue;
      if (requiredModules.length === 0) continue;
      for (const call of detectHttpCalls(parsed)) {
        if (!call.sourceSymbol) continue;
        apiCallsFound += 1;
        await this.neo4j.upsertApiCall({
          callerId: buildNodeId(parsed.originalFilePath, call.sourceSymbol),
          method: call.method,
          url: call.url,
          sourceFile: path.relative(targetPath, call.sourceFile),
          sourceLine: call.sourceLine,
          sourceSymbol: call.sourceSymbol,
          confidence: call.confidence,
        });
      }
    }

    return {
      repositoryId: externalReference,
      filesScanned: files.length,
      filesParsed,
      screensFound,
      apiCallsFound,
      backendRoutesFound,
      methodCallsFound,
    };
  }

  /** resolves a local-module reference (e.g. "controller" or "business") to the real file it was `require`d/imported from — shared by CA03 (route handler) and CA04 (method-to-method call) resolution. `null` when the object isn't a resolvable local module (e.g. `res`/`req`, or a bare name that isn't `require`d at all). */
  private resolveLocalCallTarget(
    objectName: string | null,
    fromFile: string,
    requiredModules: RequiredModule[],
    targetPath: string,
  ): string | null {
    if (!objectName) return null;
    const required = requiredModules.find((m) => m.localName === objectName);
    return required ? resolveImportPath(fromFile, required.specifier, targetPath) : null;
  }

  async getDependencies(systemArtifactId: string) {
    const { externalReference } = await this.resolveSystemArtifactReference(systemArtifactId);
    return this.neo4j.getRepositoryMapping(externalReference);
  }

  /**
   * "Artefatos relacionados" — feeds the specification wizard's preview
   * (spec: help a non-technical analyst discover which OTHER catalog
   * artifacts a selected one depends on). Resolves each
   * `Neo4jDependencyRepository.getRelatedRepositories` hit (a
   * `repo:<owner>/<name>` id) back to a real, active `SystemArtifact` by
   * matching its `name` — the same convention every artifact's real repo
   * identity is composed from (`composeOwnerRepo`). `systemArtifactId` is
   * `null` when the target repo has never been analyzed/catalogued —
   * reported as-is rather than guessed.
   */
  async getRelatedSystemArtifacts(systemArtifactId: string): Promise<RelatedSystemArtifact[]> {
    const { externalReference } = await this.resolveSystemArtifactReference(systemArtifactId);
    const related = await this.neo4j.getRelatedRepositories(externalReference);
    return Promise.all(related.map((call) => this.resolveRelatedSystemArtifact(call)));
  }

  private async resolveRelatedSystemArtifact(
    call: RelatedRepositoryCall,
  ): Promise<RelatedSystemArtifact> {
    const repoName = call.repositoryId.split("/").pop() ?? call.repositoryId;
    const match = await this.prisma.db.systemArtifact.findFirst({
      where: { name: repoName, stAtivo: true },
    });
    return {
      method: call.method,
      url: call.url,
      repositoryId: call.repositoryId,
      systemArtifactId: match?.id ?? null,
      systemArtifactName: match?.name ?? null,
      systemArtifactType: match?.type ?? null,
      systemId: match?.systemId ?? null,
    };
  }

  private async resolveSystemArtifactReference(systemArtifactId: string) {
    const systemArtifact = await this.prisma.db.systemArtifact.findUnique({
      where: { id: systemArtifactId },
    });
    if (!systemArtifact) throw new NotFoundException(`SystemArtifact ${systemArtifactId} not found`);

    const repoLink = await this.prisma.db.systemArtifactRepository.findFirst({
      where: { systemArtifactId, stAtivo: true },
    });
    if (!repoLink) throw new NotFoundException(`SystemArtifact ${systemArtifactId} has no linked repository`);

    const repository = await this.prisma.db.repository.findUniqueOrThrow({
      where: { id: repoLink.repositoryId },
    });
    return {
      externalReference: composeOwnerRepo(repository.externalReference, systemArtifact.name),
      name: systemArtifact.name,
    };
  }

  /**
   * Demand-independent clone, deliberately separate from
   * `DeveloperAgentService`'s `workspace/<demandId>/artefatos/...` paths —
   * this feature analyzes a repository's stable state, not one demand's
   * feature branch, and must not interfere with (or depend on) any
   * in-progress demand workspace. Keyed by `runId` (not repo name): every
   * run gets its own directory and is deleted afterward (see
   * `analyzeArtifact`'s `finally`) — never reused across runs.
   */
  private resolveAnalysisClonePath(runId: string): string {
    return path.join(WORKSPACE_ROOT, "_dependency-analysis", runId);
  }

  private async ensureCloned(externalReference: string, targetPath: string, branch: string): Promise<void> {
    await this.codeRepositoryProvider.cloneRepository(externalReference, targetPath);
    await this.codeRepositoryProvider.checkoutBranch(targetPath, branch);
  }
}
