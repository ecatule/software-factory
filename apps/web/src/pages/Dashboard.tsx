import { Link } from "react-router-dom";
import { useDashboardSummary } from "../services/useDashboardSummary";

/** spec User Story 2: landing page — stage counts + recently updated demands. */
export function Dashboard() {
  const { data, isLoading, isError } = useDashboardSummary();

  if (isLoading) return <p>Loading dashboard…</p>;
  if (isError || !data) return <p>Failed to load dashboard.</p>;

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <section>
        <h2>Demands by stage</h2>
        <ul className="stage-counts">
          {data.stageCounts.map((s) => (
            <li key={s.stage}>
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
