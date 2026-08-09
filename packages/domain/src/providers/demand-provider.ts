export interface DemandRecord {
  externalId: string;
  origin: string;
  title: string;
  description: string;
  type: "BUG" | "FEATURE" | "IMPROVEMENT" | "TASK" | "TECHNICAL_DEBT";
  priority: string;
  status: string;
}

export interface DemandFilter {
  status?: string;
  clientId?: string;
  projectId?: string;
}

/**
 * spec FR-003: the platform's only integration point with a demand source
 * (Monday first). No business/domain module may depend on a vendor SDK
 * directly — only implementations of this interface may.
 */
export interface DemandProvider {
  getDemand(externalId: string): Promise<DemandRecord>;
  listDemands(filter: DemandFilter): Promise<DemandRecord[]>;
  updateDemandStatus(externalId: string, status: string): Promise<void>;
}

export const DEMAND_PROVIDER = Symbol("DEMAND_PROVIDER");
