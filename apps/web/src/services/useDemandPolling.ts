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
 * spec SC-008 / research.md §5: the cockpit must reflect a finished stage's
 * result within 5 seconds. A 2-second poll interval is the chosen mechanism
 * — simple, no extra push/streaming infrastructure — and comfortably beats
 * the 5s target.
 */
const POLL_INTERVAL_MS = 2000;

export function useDemandPolling(demandId: string) {
  const demand = useQuery({
    queryKey: ["demand", demandId],
    queryFn: () => apiGet<Demand>(`/demands/${demandId}`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const workflow = useQuery({
    queryKey: ["demand", demandId, "workflow"],
    queryFn: () => apiGet<WorkflowView>(`/demands/${demandId}/workflow`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const workspace = useQuery({
    queryKey: ["demand", demandId, "workspace"],
    queryFn: () => apiGet<DemandWorkspace | null>(`/demands/${demandId}/workspace`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const artifacts = useQuery({
    queryKey: ["demand", demandId, "artifacts"],
    queryFn: () => apiGet<Artifact[]>(`/demands/${demandId}/artifacts`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const specifications = useQuery({
    queryKey: ["demand", demandId, "specifications"],
    queryFn: () => apiGet<Specification[]>(`/demands/${demandId}/specifications`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const timeline = useQuery({
    queryKey: ["demand", demandId, "timeline"],
    queryFn: () => apiGet<TimelineEntry[]>(`/demands/${demandId}/timeline`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const gitActivity = useQuery({
    queryKey: ["demand", demandId, "git"],
    queryFn: () => apiGet<GitActivity>(`/demands/${demandId}/git`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return { demand, workflow, workspace, artifacts, specifications, timeline, gitActivity };
}
