import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowView } from "../services/types";

interface Props {
  workflow?: WorkflowView;
}

/** spec User Story 5, Acceptance Scenario 1: distinguish completed/current/pending stages. */
export function WorkflowProgress({ workflow }: Props) {
  if (!workflow) return <p className="text-sm text-muted-foreground">Loading workflow…</p>;

  const currentIndex = workflow.stages.findIndex((s) => s.key === workflow.currentStage);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {workflow.stages.map((stage, index) => {
        const state =
          index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending";
        return (
          <li
            key={stage.id}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              state === "completed" && "border-success/30 bg-success/10 text-success",
              state === "current" && "border-primary bg-primary text-primary-foreground",
              state === "pending" && "border-border bg-card text-muted-foreground",
            )}
          >
            {state === "completed" && <Check className="size-3" />}
            {stage.key}
          </li>
        );
      })}
    </ol>
  );
}
