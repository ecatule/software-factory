import { useParams } from "react-router-dom";
import { useDemandPolling } from "../services/useDemandPolling";
import { WorkflowProgress } from "../components/WorkflowProgress";
import { WorkspaceTree } from "../components/WorkspaceTree";
import { ArtifactList } from "../components/ArtifactList";
import { SpecificationList } from "../components/SpecificationList";
import { Timeline } from "../components/Timeline";
import { GitActivity } from "../components/GitActivity";

/**
 * spec User Story 5: a single view per demand showing workflow progress,
 * workspace, artifacts, specifications, and a chronological timeline —
 * assembled entirely from the read-model endpoints built in Phases 3–6
 * (US1–US4), refreshed every 2s (spec SC-008).
 */
export function DemandCockpit() {
  const { demandId } = useParams<{ demandId: string }>();
  const { demand, workflow, workspace, artifacts, specifications, timeline, gitActivity } =
    useDemandPolling(demandId ?? "");

  if (!demandId) return <p>No demand selected.</p>;
  if (demand.isLoading) return <p>Loading demand…</p>;
  if (demand.isError) return <p>Failed to load demand.</p>;

  return (
    <div className="demand-cockpit">
      <h1>
        {demand.data?.title} <small>({demand.data?.status})</small>
      </h1>

      <section>
        <h2>Workflow</h2>
        <WorkflowProgress workflow={workflow.data} />
      </section>

      <section>
        <h2>Workspace</h2>
        <WorkspaceTree workspace={workspace.data} />
      </section>

      <section>
        <h2>Artifacts</h2>
        <ArtifactList artifacts={artifacts.data} />
      </section>

      <section>
        <h2>Specifications</h2>
        <SpecificationList specifications={specifications.data} />
      </section>

      <section>
        <h2>Timeline</h2>
        <Timeline entries={timeline.data} />
      </section>

      <section>
        <h2>Git</h2>
        <GitActivity activity={gitActivity.data} />
      </section>
    </div>
  );
}
