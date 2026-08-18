import neo4j, { type Driver } from "neo4j-driver";
import type { GraphQueryResult, GraphStoreProvider } from "@software-factory/domain";

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

/**
 * Concrete `GraphStoreProvider` adapter — the only place allowed to import
 * `neo4j-driver` directly (constitution Principle II). One driver per
 * process; sessions are opened/closed per query. The dependency-analyzer
 * module owns the actual Cypher (node/relationship schema) — this class is
 * intentionally just a thin "run a query" transport.
 */
export class Neo4jGraphStoreProvider implements GraphStoreProvider {
  private readonly driver: Driver;
  private readonly database?: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
    this.database = config.database;
  }

  async run(cypher: string, params: Record<string, unknown> = {}): Promise<GraphQueryResult> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(cypher, params);
      return { records: result.records.map((record) => record.toObject()) };
    } finally {
      await session.close();
    }
  }

  /** not part of `GraphStoreProvider` — called from a NestJS `OnApplicationShutdown` hook so the driver doesn't leak connections across restarts. */
  async close(): Promise<void> {
    await this.driver.close();
  }
}
