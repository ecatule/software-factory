import type {
  DemandFilter,
  DemandProvider,
  DemandRecord,
} from "@software-factory/domain";

interface MondayConfig {
  apiUrl: string;
  apiToken: string;
}

/**
 * spec FR-003: the only place Monday's GraphQL API is called from. Domain
 * and application code depend on `DemandProvider`, never on this class or
 * on Monday's API shape directly (constitution: Provider Abstraction).
 */
export class MondayDemandProvider implements DemandProvider {
  constructor(private readonly config: MondayConfig) {}

  async getDemand(externalId: string): Promise<DemandRecord> {
    const data = await this.graphql(
      `query ($id: ID!) { items (ids: [$id]) { id name state column_values { id text } } }`,
      { id: externalId },
    );
    const item = data.items?.[0];
    if (!item) {
      throw new Error(`Monday item ${externalId} not found`);
    }
    return this.toDemandRecord(item);
  }

  async listDemands(filter: DemandFilter): Promise<DemandRecord[]> {
    const data = await this.graphql(
      `query ($boardId: ID!) { boards (ids: [$boardId]) { items { id name state column_values { id text } } } }`,
      { boardId: filter.projectId ?? "" },
    );
    const items = data.boards?.[0]?.items ?? [];
    return items.map((item: unknown) => this.toDemandRecord(item));
  }

  async updateDemandStatus(externalId: string, status: string): Promise<void> {
    await this.graphql(
      `mutation ($id: ID!, $status: String!) {
        change_simple_column_value (item_id: $id, column_id: "status", value: $status) { id }
      }`,
      { id: externalId, status },
    );
  }

  private async graphql(query: string, variables: Record<string, unknown>) {
    const response = await fetch(this.config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.apiToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Monday API error: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { data: any; errors?: unknown[] };
    if (json.errors?.length) {
      throw new Error(`Monday API returned errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
  }

  private toDemandRecord(item: any): DemandRecord {
    const columns: Record<string, string> = Object.fromEntries(
      (item.column_values ?? []).map((c: { id: string; text: string }) => [c.id, c.text]),
    );
    return {
      externalId: item.id,
      origin: "monday",
      title: item.name,
      description: columns.description ?? "",
      type: (columns.type as DemandRecord["type"]) ?? "TASK",
      priority: columns.priority ?? "medium",
      status: item.state ?? "active",
    };
  }
}
