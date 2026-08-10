import { Link, useNavigate } from "react-router-dom";
import { useDashboardSummary } from "../services/useDashboardSummary";

const BUCKET_STATUSES: Record<string, string> = {
  open: "NEW",
  inSpecification: "SPECIFICATION,CLARIFICATION,PLANNING,CHECKLIST",
  inDevelopment: "DEVELOPMENT,TESTING,COMMIT,PULL_REQUEST",
  blocked: "BLOCKED,FAILED",
};

/** spec User Story 2 / feature 004 US3: landing page — richer KPIs, each click-through to a filtered Demands list. */
export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDashboardSummary();

  if (isLoading) return <p>Loading dashboard…</p>;
  if (isError || !data) return <p>Failed to load dashboard.</p>;

  function goToDemands(query: string) {
    navigate(`/demands?${query}`);
  }

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <section>
        <h2>Totals</h2>
        <ul className="stage-counts">
          <li onClick={() => goToDemands("")} style={{ cursor: "pointer" }}>
            <strong>{data.totals.all}</strong> Total demands
          </li>
          <li
            onClick={() => goToDemands(`status_in=${BUCKET_STATUSES.open}`)}
            style={{ cursor: "pointer" }}
          >
            <strong>{data.totals.open}</strong> Open
          </li>
          <li
            onClick={() => goToDemands(`status_in=${BUCKET_STATUSES.inSpecification}`)}
            style={{ cursor: "pointer" }}
          >
            <strong>{data.totals.inSpecification}</strong> In specification
          </li>
          <li
            onClick={() => goToDemands(`status_in=${BUCKET_STATUSES.inDevelopment}`)}
            style={{ cursor: "pointer" }}
          >
            <strong>{data.totals.inDevelopment}</strong> In development
          </li>
          <li
            onClick={() => goToDemands(`status_in=${BUCKET_STATUSES.blocked}`)}
            style={{ cursor: "pointer" }}
          >
            <strong>{data.totals.blocked}</strong> Blocked
          </li>
          <li onClick={() => goToDemands("pr_status=OPEN")} style={{ cursor: "pointer" }}>
            <strong>{data.pullRequestsOpen}</strong> PRs open
          </li>
          <li
            onClick={() => goToDemands("has_failing_tests=true")}
            style={{ cursor: "pointer" }}
          >
            <strong>{data.testsFailing}</strong> Tests failing
          </li>
          <li onClick={() => goToDemands("agent_status=RUNNING")} style={{ cursor: "pointer" }}>
            <strong>{data.agentsRunning}</strong> Agents running
          </li>
        </ul>
      </section>

      <section>
        <h2>Demands by client</h2>
        <ul className="stage-counts">
          {data.byClient.map((c) => (
            <li
              key={c.clientId}
              onClick={() => goToDemands(`client_id=${c.clientId}`)}
              style={{ cursor: "pointer" }}
            >
              <strong>{c.count}</strong> {c.clientName}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Average time per stage</h2>
        <ul className="stage-counts">
          {data.avgTimePerStage.map((s) => (
            <li
              key={s.stage}
              onClick={() => goToDemands(`status=${s.stage}`)}
              style={{ cursor: "pointer" }}
            >
              <strong>{s.avgHours.toFixed(1)}h</strong> {s.stage}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Demands by stage</h2>
        <ul className="stage-counts">
          {data.stageCounts.map((s) => (
            <li
              key={s.stage}
              onClick={() => goToDemands(`status=${s.stage}`)}
              style={{ cursor: "pointer" }}
            >
              <strong>{s.count}</strong> {s.stage}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Recently updated demands</h2>
        <ul>
          {data.recentDemands.map((demand) => (
            <li key={demand.id}>
              <Link to={`/demands/${demand.id}`}>
                {demand.title} — {demand.status}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
