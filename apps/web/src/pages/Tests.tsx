import { useState } from "react";
import { Badge } from "@software-factory/ui";
import { useDemandTests, useRunDemandTests } from "../services/useDemandTests";
import { useDemandsList } from "../services/useDemands";

/** spec User Story 11: per-demand test results (not cross-demand, per spec.md). */
export function Tests() {
  const [demandId, setDemandId] = useState<string | null>(null);
  const { data: demands } = useDemandsList({ pageSize: 100 });
  const { data: tests, isLoading } = useDemandTests(demandId);
  const runTests = useRunDemandTests(demandId);

  return (
    <div className="tests-page">
      <h1>Tests</h1>

      <div className="form-field">
        <label htmlFor="demandId">Demand</label>
        <select id="demandId" value={demandId ?? ""} onChange={(e) => setDemandId(e.target.value || null)}>
          <option value="">Select a demand…</option>
          {demands?.items.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>

      {demandId && (
        <>
          <button type="button" onClick={() => runTests.mutate()} disabled={runTests.isPending}>
            Run required suites
          </button>

          {isLoading && <p>Loading test results…</p>}
          <ul className="test-results">
            {tests?.map((t) => (
              <li key={t.id}>
                <Badge label={t.status} tone={t.status === "FAILED" ? "danger" : t.status === "PASSED" ? "success" : "neutral"} />
                {" "}
                {t.suite}
                {t.result && (
                  <span>
                    {" "}
                    ({t.result.passedCount} passed, {t.result.failedCount} failed, {t.result.skippedCount} skipped)
                  </span>
                )}
                {t.status === "FAILED" && t.error && <pre>{t.error}</pre>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
