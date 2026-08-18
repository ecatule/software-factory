export interface GraphQueryResult {
  records: Array<Record<string, unknown>>;
}

/**
 * Thin abstraction over the graph database connection — same Provider
 * Abstraction shape as `StorageProvider`/`CodeRepositoryProvider`
 * (constitution Principle II): `apps/api` modules never import the
 * `neo4j-driver` package directly, only `packages/infrastructure` may.
 *
 * Deliberately just "run a query" rather than a node/edge-typed interface —
 * the dependency-analyzer's graph schema (Repository/Screen/API/Controller/
 * Service/Table/Redis/Queue/... nodes, a dozen relationship types) is rich
 * and feature-specific; forcing it through a generic upsertNode/upsertEdge
 * shape would either lose information or leak the feature's schema into the
 * domain-wide provider interface. The feature module owns its own Cypher.
 */
export interface GraphStoreProvider {
  run(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
}

export const GRAPH_STORE_PROVIDER = Symbol("GRAPH_STORE_PROVIDER");
