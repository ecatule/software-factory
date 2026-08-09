import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import type { DashboardSummary } from "./types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
  });
}
