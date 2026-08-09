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
  documentType: string;
  currentVersionId: string | null;
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
}
