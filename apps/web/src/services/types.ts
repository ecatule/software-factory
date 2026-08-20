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
  branches: { id: string; name: string; artifactId: string }[];
  commits: { id: string; sha: string; artifactId: string }[];
  pull_requests: { id: string; externalReference: string; status: string; artifactId: string | null }[];
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
  /** Dashboard highlight — total AuditLog activity per day, last 7 days (oldest → newest), zero-filled. */
  dailyActivity: { date: string; label: string; count: number }[];
}

export interface Client {
  id: string;
  name: string;
  externalReference?: string | null;
  mondayClientLabel?: string | null;
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
  /** follow-up: `.specify/memory/constitution.md` content applied to every demand's workspace before any SDD stage runs. */
  constitution: string | null;
  /** feature 006 (spec FR-008/FR-009): padrão desabilitada — controla se a execução automática de testes pode ocorrer como parte do pipeline deste Projeto. */
  qaAutoExecutionEnabled: boolean;
}
