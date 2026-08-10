export interface Demand {
  id: string;
  externalId: string;
  origin: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  clientId: string;
  projectId: string;
  responsibleUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStage {
  id: string;
  key: string;
  order: number;
}

export interface WorkflowView {
  stages: WorkflowStage[];
  currentStage: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
}

export interface DemandWorkspace {
  id: string;
  demandId: string;
  path: string;
  status: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  technology?: string | null;
  status: string;
}

export interface Specification {
  id: string;
  demandId: string;
  documentType: string;
  currentVersionId: string | null;
}

/** feature 003 (packages/domain SpecificationProposal, mirrored for the frontend). */
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
  changeSummary: {
    rulesAdded: string[];
    artifactsImpacted: string[];
    apisImpacted: string[];
    dataImpacted: string[];
    suggestedTests: string[];
  };
}

export interface GitActivity {
  repositories: { id: string; externalReference: string }[];
  branches: { id: string; name: string }[];
  commits: { id: string; sha: string }[];
  pull_requests: { id: string; externalReference: string; status: string }[];
}

/** Shared envelope every 002-web-console list endpoint returns (data-model.md). */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  stageCounts: { stage: string; count: number }[];
  recentDemands: Demand[];
  /** feature 004 FR-009-FR-012. */
  totals: {
    all: number;
    open: number;
    inSpecification: number;
    inDevelopment: number;
    blocked: number;
  };
  pullRequestsOpen: number;
  testsFailing: number;
  agentsRunning: number;
  byClient: { clientId: string; clientName: string; count: number }[];
  avgTimePerStage: { stage: string; avgHours: number }[];
}

export interface Client {
  id: string;
  name: string;
  externalReference?: string | null;
  version: number;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  technologies: string[];
  branchNamingPolicy: string;
  requiredTestSuites: string[];
  version: number;
  /** feature 004 FR-001. */
  productionBranch: string | null;
  homologationBranch: string | null;
  homologationEnvironment: string | null;
  productionEnvironment: string | null;
}
