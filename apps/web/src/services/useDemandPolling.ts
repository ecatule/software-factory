import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type {
  Artifact,
  Demand,
  DemandWorkspace,
  GitActivity,
  Specification,
  TimelineEntry,
  WorkflowView,
} from "./types";

/**
 * Originally polled every 2s per spec 001 SC-008. Changed to fetch-once +
 * manual refresh after user feedback: continuously firing 7 requests per
 * demand, forever, while the cockpit is open was unwanted background load.
 * The cockpit now exposes a "Refresh" action (`refetchAll`) instead.
 */
export function useDemandPolling(demandId: string) {
  const demand = useQuery({
    queryKey: ["demand", demandId],
    queryFn: () => apiGet<Demand>(`/demands/${demandId}`),
  });

  const workflow = useQuery({
    queryKey: ["demand", demandId, "workflow"],
    queryFn: () => apiGet<WorkflowView>(`/demands/${demandId}/workflow`),
  });

  const workspace = useQuery({
    queryKey: ["demand", demandId, "workspace"],
    queryFn: () => apiGet<DemandWorkspace | null>(`/demands/${demandId}/workspace`),
  });

  const artifacts = useQuery({
    queryKey: ["demand", demandId, "artifacts"],
    queryFn: () => apiGet<Artifact[]>(`/demands/${demandId}/artifacts`),
  });

  const specifications = useQuery({
    queryKey: ["demand", demandId, "specifications"],
    queryFn: () => apiGet<Specification[]>(`/demands/${demandId}/specifications`),
  });

  const timeline = useQuery({
    queryKey: ["demand", demandId, "timeline"],
    queryFn: () => apiGet<TimelineEntry[]>(`/demands/${demandId}/timeline`),
  });

  const gitActivity = useQuery({
    queryKey: ["demand", demandId, "git"],
    queryFn: () => apiGet<GitActivity>(`/demands/${demandId}/git`),
  });

  function refetchAll() {
    demand.refetch();
    workflow.refetch();
    workspace.refetch();
    artifacts.refetch();
    specifications.refetch();
    timeline.refetch();
    gitActivity.refetch();
  }

  return { demand, workflow, workspace, artifacts, specifications, timeline, gitActivity, refetchAll };
}
