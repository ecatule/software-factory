/**
 * feature 003 (research.md §4): the structured shape an LLMProvider must
 * return for an AI-assisted specification round. Validated by
 * ExecutionsProcessor before being split into SpecificationVersion rows —
 * never persisted or trusted unvalidated.
 */
export interface SpecificationProposal {
  summary: string;
  businessRequirements: string[];
  businessRules: string[];
  acceptanceCriteria: string[];
  flows: string[];
  technicalRequirements: string[];
  identifiedArtifacts: string[];
  suggestedArtifacts: string[];
  risks: string[];
  questions: string[];
  specifyMarkdown: string;
  planMarkdown: string;
  /** spec FR-020: populated for increment rounds beyond #1; empty otherwise. */
  changeSummary: {
    rulesAdded: string[];
    artifactsImpacted: string[];
    apisImpacted: string[];
    dataImpacted: string[];
    suggestedTests: string[];
  };
}
