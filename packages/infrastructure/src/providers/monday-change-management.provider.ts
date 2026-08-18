import type {
  ChangeManagementProvider,
  ChangeManagementRequestInput,
  ChangeManagementRequestResult,
} from "@software-factory/domain";

interface MondayConfig {
  apiUrl: string;
  apiToken: string;
}

/**
 * GMUD board is fixed for the whole platform (not per-project/configurable
 * — the user gave one specific board for change-management requests),
 * confirmed live via a read-only GraphQL query against the real board:
 * name "Gestão de mudanças", group "topics" (title "Socitações de deploy").
 * Column ids below are the board's real ids, not guessed.
 */
const BOARD_ID = "18399639420";
const GROUP_ID = "topics";
const COLUMN_IDS = {
  status: "status",
  client: "dropdown_mm0f5sb",
  environment: "dropdown_mm0f1597",
  artifacts: "long_text_mm0ff99r",
  requestDate: "data",
} as const;

/** the board's "just opened" status label — set explicitly rather than relying on Monday's undocumented default-first-label behavior. */
const INITIAL_STATUS_LABEL = "Aguardando";

export class MondayChangeManagementProvider implements ChangeManagementProvider {
  constructor(private readonly config: MondayConfig) {}

  async createChangeRequest(
    input: ChangeManagementRequestInput,
  ): Promise<ChangeManagementRequestResult> {
    const columnValues = {
      [COLUMN_IDS.status]: { label: INITIAL_STATUS_LABEL },
      [COLUMN_IDS.client]: { labels: [input.clientLabel] },
      [COLUMN_IDS.environment]: { labels: [input.environmentLabel] },
      [COLUMN_IDS.artifacts]: { text: input.artifactsText },
      [COLUMN_IDS.requestDate]: { date: input.requestDate },
    };

    const data = await this.graphql(
      `mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item (
          board_id: $boardId,
          group_id: $groupId,
          item_name: $itemName,
          column_values: $columnValues
        ) { id }
      }`,
      {
        boardId: BOARD_ID,
        groupId: GROUP_ID,
        itemName: input.itemName,
        columnValues: JSON.stringify(columnValues),
      },
    );

    const itemId = data.create_item?.id;
    if (!itemId) {
      throw new Error("Monday API did not return an item id for the created GMUD request");
    }
    return {
      externalId: itemId,
      url: `https://vexur-company.monday.com/boards/${BOARD_ID}/pulses/${itemId}`,
    };
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
}
