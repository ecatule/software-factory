import { Inject, Injectable } from "@nestjs/common";
import { GRAPH_STORE_PROVIDER, type GraphStoreProvider } from "@software-factory/domain";
import type { Confidence } from "./analyzers/http-call.analyzer";

export interface ScreenApiCallEvidence {
  screenId: string;
  screenName: string;
  method: string;
  url: string;
  sourceFile: string;
  sourceLine: number;
  sourceSymbol?: string;
  confidence: Confidence;
}

export interface ExposedRouteEvidence {
  method: string;
  url: string;
  controllerName: string | null;
  controllerSourceFile: string | null;
  controllerSourceLine: number | null;
  serviceName: string | null;
  serviceSourceFile: string | null;
  serviceSourceLine: number | null;
}

export interface OutboundApiCallEvidence {
  callerId: string;
  method: string;
  url: string;
  sourceFile: string;
  sourceLine: number;
  sourceSymbol?: string;
  confidence: Confidence;
}

export interface RepositoryMapping {
  screens: ScreenApiCallEvidence[];
  exposedRoutes: ExposedRouteEvidence[];
  outboundCalls: OutboundApiCallEvidence[];
}

export interface RelatedRepositoryCall {
  method: string;
  url: string;
  repositoryId: string;
}

/**
 * spec (Mapa de Dependências) §5/§6/§17: the Neo4j-specific schema for this
 * feature — node/relationship types and their Cypher. Deliberately NOT
 * exposed as a generic `upsertNode`/`upsertEdge` (see `GraphStoreProvider`'s
 * own doc-comment) since this domain has ~15 node types and a dozen
 * relationship types; this repository is where that richness lives.
 * `MERGE` everywhere so re-running an analysis is idempotent (spec §18) —
 * stable ids only, never auto-generated ones (spec §7).
 */
@Injectable()
export class Neo4jDependencyRepository {
  constructor(
    @Inject(GRAPH_STORE_PROVIDER) private readonly graphStore: GraphStoreProvider,
  ) {}

  async ensureConstraints(): Promise<void> {
    await this.graphStore.run(
      "CREATE CONSTRAINT repository_id IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE",
    );
    await this.graphStore.run(
      "CREATE CONSTRAINT screen_id IF NOT EXISTS FOR (s:Screen) REQUIRE s.id IS UNIQUE",
    );
    await this.graphStore.run(
      "CREATE CONSTRAINT api_id IF NOT EXISTS FOR (a:API) REQUIRE a.id IS UNIQUE",
    );
    await this.graphStore.run(
      "CREATE CONSTRAINT controller_id IF NOT EXISTS FOR (c:Controller) REQUIRE c.id IS UNIQUE",
    );
    await this.graphStore.run(
      "CREATE CONSTRAINT service_id IF NOT EXISTS FOR (s:Service) REQUIRE s.id IS UNIQUE",
    );
  }

  async upsertRepository(id: string, name: string): Promise<void> {
    await this.graphStore.run("MERGE (r:Repository {id: $id}) SET r.name = $name", { id, name });
  }

  async upsertScreen(params: {
    id: string;
    name: string;
    filePath: string;
    line: number;
    repositoryId: string;
  }): Promise<void> {
    await this.graphStore.run(
      "MERGE (s:Screen {id: $id}) SET s.name = $name, s.filePath = $filePath, s.line = $line " +
        "WITH s MATCH (r:Repository {id: $repositoryId}) " +
        "MERGE (r)-[:CONTAINS]->(s)",
      params,
    );
  }

  /**
   * MERGEs the API node (keyed globally by method+url — the same endpoint
   * called from different repos converges on one node, per spec §9 "Quais
   * telas utilizam uma API?") and the CALLS_API edge carrying the evidence.
   * `callerId` is label-less on purpose (same reasoning as
   * `upsertMethodCall`) — a Screen, Controller, or Service can all call an
   * API, and this reuses whichever node already exists at that id instead of
   * needing a separate method per caller type. This is also what makes
   * "API → API" (spec §4.10/§10) fall out for free: a backend Service
   * calling another API is just this same method with a Service `callerId`
   * — if that URL happens to match a route another analyzed repo `EXPOSES`,
   * they land on the identical `API` node with no extra correlation code.
   */
  async upsertApiCall(params: {
    callerId: string;
    method: string;
    url: string;
    sourceFile: string;
    sourceLine: number;
    sourceSymbol?: string;
    confidence: Confidence;
  }): Promise<void> {
    const apiId = `${params.method} ${params.url}`;
    await this.graphStore.run(
      "MERGE (a:API {id: $apiId}) SET a.method = $method, a.url = $url " +
        "WITH a MERGE (caller {id: $callerId}) " +
        "MERGE (caller)-[c:CALLS_API]->(a) " +
        "SET c.sourceFile = $sourceFile, c.sourceLine = $sourceLine, c.sourceSymbol = $sourceSymbol, c.confidence = $confidence",
      { ...params, apiId },
    );
  }

  /**
   * spec §4.5/§6/§10 "Extractor de Backend": MERGEs the same `API` node type
   * used by `upsertScreenApiCall` (keyed by `${method} ${path}`) — a
   * frontend call whose resolved URL literally matches a backend route's
   * registered path converges on the SAME node, without any extra
   * cross-repo correlation logic. `(:Repository)-[:EXPOSES]->(:API)` marks
   * this repo as the one that offers the endpoint (distinct from `CONTAINS`,
   * used for Screen — that's internal file structure, this is a public
   * surface). When the handler's file is resolvable (`require`/import), also
   * MERGEs `(:API)-[:IMPLEMENTED_BY]->(:Controller)` with evidence — spec
   * CA03 only asks for this "quando possível", so an unresolved handler
   * still records the route+API, just without the Controller edge.
   */
  async upsertBackendRoute(params: {
    method: string;
    routePath: string;
    repositoryId: string;
    controllerId: string | null;
    controllerName: string | null;
    sourceFile: string;
    sourceLine: number;
  }): Promise<void> {
    const apiId = `${params.method} ${params.routePath}`;
    await this.graphStore.run(
      "MERGE (a:API {id: $apiId}) SET a.method = $method, a.url = $routePath " +
        "WITH a MATCH (r:Repository {id: $repositoryId}) " +
        "MERGE (r)-[:EXPOSES]->(a)",
      { ...params, apiId },
    );
    if (!params.controllerId) return;
    await this.graphStore.run(
      "MERGE (c:Controller {id: $controllerId}) SET c.name = $controllerName " +
        "WITH c MATCH (a:API {id: $apiId}) " +
        "MERGE (a)-[i:IMPLEMENTED_BY]->(c) " +
        "SET i.sourceFile = $sourceFile, i.sourceLine = $sourceLine",
      { ...params, apiId },
    );
  }

  /**
   * spec CA04 "Controller → Service": `caller` is MERGEd label-less — it
   * usually already exists as a `:Controller` (from `upsertBackendRoute`),
   * and a label-less `MERGE {id: ...}` still matches/reuses that node
   * regardless of its label, rather than creating a second, unlabeled
   * duplicate. `callee` is always labeled `:Service` — proportional to what
   * CA04 asks for (a Controller→Service edge), not a full type-inference
   * system distinguishing Service from other kinds of called modules.
   */
  async upsertMethodCall(params: {
    callerId: string;
    calleeId: string;
    calleeName: string;
    sourceFile: string;
    sourceLine: number;
  }): Promise<void> {
    await this.graphStore.run(
      "MERGE (caller {id: $callerId}) " +
        "WITH caller " +
        "MERGE (callee:Service {id: $calleeId}) SET callee.name = $calleeName " +
        "MERGE (caller)-[c:CALLS]->(callee) " +
        "SET c.sourceFile = $sourceFile, c.sourceLine = $sourceLine",
      params,
    );
  }

  /** spec §9 "Quais APIs uma tela utiliza?" */
  async getApisCalledByRepository(repositoryId: string): Promise<ScreenApiCallEvidence[]> {
    const result = await this.graphStore.run(
      "MATCH (:Repository {id: $repositoryId})-[:CONTAINS]->(s:Screen)-[c:CALLS_API]->(a:API) " +
        "RETURN s.id AS screenId, s.name AS screenName, a.method AS method, a.url AS url, " +
        "c.sourceFile AS sourceFile, c.sourceLine AS sourceLine, c.sourceSymbol AS sourceSymbol, c.confidence AS confidence",
      { repositoryId },
    );
    return result.records.map((record) => record as unknown as ScreenApiCallEvidence);
  }

  /** spec §9 "Quais telas utilizam uma API?" */
  async getScreensCallingApi(method: string, url: string): Promise<ScreenApiCallEvidence[]> {
    const apiId = `${method} ${url}`;
    const result = await this.graphStore.run(
      "MATCH (s:Screen)-[c:CALLS_API]->(a:API {id: $apiId}) " +
        "RETURN s.id AS screenId, s.name AS screenName, a.method AS method, a.url AS url, " +
        "c.sourceFile AS sourceFile, c.sourceLine AS sourceLine, c.sourceSymbol AS sourceSymbol, c.confidence AS confidence",
      { apiId },
    );
    return result.records.map((record) => record as unknown as ScreenApiCallEvidence);
  }

  /**
   * Full picture of what one Repository's analysis produced — backs the
   * "Ver mapeamento" modal on the Artefatos screen. Generalizes
   * `getApisCalledByRepository` (Screen-only) with the two halves it was
   * missing: what this repo EXPOSES (its own routes, and — when resolvable —
   * their Controller/Service chain) and what its Controllers/Services call
   * OUTBOUND on other APIs (the "API → API" edges, which never attach to
   * `Repository` via a graph relationship since their caller node is
   * label-less — matched instead by `callerId` sharing this repo's id
   * prefix, the same prefix every node id in this repo was built with, see
   * `dependency-analyzer.service.ts`'s `buildNodeId`).
   */
  async getRepositoryMapping(repositoryId: string): Promise<RepositoryMapping> {
    const screensResult = await this.graphStore.run(
      "MATCH (:Repository {id: $repositoryId})-[:CONTAINS]->(s:Screen)-[c:CALLS_API]->(a:API) " +
        "RETURN s.id AS screenId, s.name AS screenName, a.method AS method, a.url AS url, " +
        "c.sourceFile AS sourceFile, c.sourceLine AS sourceLine, c.sourceSymbol AS sourceSymbol, c.confidence AS confidence",
      { repositoryId },
    );

    const exposedRoutesResult = await this.graphStore.run(
      "MATCH (r:Repository {id: $repositoryId})-[:EXPOSES]->(a:API) " +
        "OPTIONAL MATCH (a)-[i:IMPLEMENTED_BY]->(c:Controller) " +
        "OPTIONAL MATCH (c)-[cc:CALLS]->(svc:Service) " +
        "RETURN a.method AS method, a.url AS url, c.name AS controllerName, " +
        "i.sourceFile AS controllerSourceFile, i.sourceLine AS controllerSourceLine, " +
        "svc.name AS serviceName, cc.sourceFile AS serviceSourceFile, cc.sourceLine AS serviceSourceLine",
      { repositoryId },
    );

    const outboundCallsResult = await this.graphStore.run(
      "MATCH (caller)-[c:CALLS_API]->(a:API) " +
        "WHERE caller.id STARTS WITH $prefix AND NOT caller:Screen " +
        "RETURN caller.id AS callerId, a.method AS method, a.url AS url, " +
        "c.sourceFile AS sourceFile, c.sourceLine AS sourceLine, c.sourceSymbol AS sourceSymbol, c.confidence AS confidence",
      { prefix: `repo:${repositoryId}|` },
    );

    return {
      screens: screensResult.records.map((record) => record as unknown as ScreenApiCallEvidence),
      exposedRoutes: exposedRoutesResult.records.map((record) => ({
        method: record.method,
        url: record.url,
        controllerName: record.controllerName ?? null,
        controllerSourceFile: record.controllerSourceFile ?? null,
        controllerSourceLine: record.controllerSourceLine ?? null,
        serviceName: record.serviceName ?? null,
        serviceSourceFile: record.serviceSourceFile ?? null,
        serviceSourceLine: record.serviceSourceLine ?? null,
      })) as unknown as ExposedRouteEvidence[],
      outboundCalls: outboundCallsResult.records.map((record) => record as unknown as OutboundApiCallEvidence),
    };
  }

  /**
   * "Artefatos relacionados" (fluxo de especificação): for every API this
   * repo CALLS (as a Screen or as a backend caller — same two origins as
   * `getRepositoryMapping`'s `outboundCalls`), find which OTHER Repository
   * `EXPOSES` that exact API id. Deliberately exact-match via the graph
   * (not a URL-text heuristic) — only returns a hit when the target has
   * ALSO already been analyzed as a backend (has an `EXPOSES` edge for that
   * URL); an unanalyzed target simply doesn't appear, rather than guessing.
   * Only the outbound direction (what this repo depends on) — the inverse
   * (who calls INTO this repo) would need correlating label-less
   * Controller/Service callers back to a Repository by id-prefix, not
   * needed for "should this related artifact also be in my demand?".
   */
  async getRelatedRepositories(repositoryId: string): Promise<RelatedRepositoryCall[]> {
    const result = await this.graphStore.run(
      "MATCH (:Repository {id: $repositoryId})-[:CONTAINS]->(:Screen)-[:CALLS_API]->(a:API)<-[:EXPOSES]-(exposer:Repository) " +
        "WHERE exposer.id <> $repositoryId " +
        "RETURN DISTINCT a.method AS method, a.url AS url, exposer.id AS repositoryId " +
        "UNION " +
        "MATCH (caller)-[:CALLS_API]->(a:API)<-[:EXPOSES]-(exposer:Repository) " +
        "WHERE caller.id STARTS WITH $prefix AND exposer.id <> $repositoryId " +
        "RETURN DISTINCT a.method AS method, a.url AS url, exposer.id AS repositoryId",
      { repositoryId, prefix: `repo:${repositoryId}|` },
    );
    return result.records.map((record) => record as unknown as RelatedRepositoryCall);
  }
}
