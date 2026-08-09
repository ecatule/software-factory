import type { WorkflowView } from "../services/types";

interface Props {
  workflow?: WorkflowView;
}

/** spec User Story 5, Acceptance Scenario 1: distinguish completed/current/pending stages. */
export function WorkflowProgress({ workflow }: Props) {
  if (!workflow) return <p>Loading workflow…</p>;

  const currentIndex = workflow.stages.findIndex((s) => s.key === workflow.currentStage);

  return (
    <ol className="workflow-progress">
      {workflow.stages.map((stage, index) => {
        const state =
          index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending";
        return (
          <li key={stage.id} data-state={state}>
            {stage.key}
          </li>
        );
      })}
    </ol>
  );
}
