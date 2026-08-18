export interface ChangeManagementRequestInput {
  itemName: string;
  clientLabel: string;
  /** exact label text the target board expects — e.g. "homologação"/"produção". */
  environmentLabel: string;
  artifactsText: string;
  /** YYYY-MM-DD */
  requestDate: string;
}

export interface ChangeManagementRequestResult {
  externalId: string;
  url: string;
}

/**
 * GMUD (Gestão de Mudanças): the platform's only integration point for
 * opening a deploy/change request on an external tracker (Monday first).
 * No business/domain module may depend on a vendor SDK directly — only
 * implementations of this interface may (constitution: Provider Abstraction).
 */
export interface ChangeManagementProvider {
  createChangeRequest(input: ChangeManagementRequestInput): Promise<ChangeManagementRequestResult>;
}

export const CHANGE_MANAGEMENT_PROVIDER = Symbol("CHANGE_MANAGEMENT_PROVIDER");
