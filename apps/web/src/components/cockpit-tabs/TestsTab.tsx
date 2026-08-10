import { useDemandTests, useRunDemandTests } from "../../services/useDemandTests";

interface Props {
  demandId: string;
}

/** feature 004 US5: per-demand test executions, previously only reachable via the cross-demand Tests page. */
export function TestsTab({ demandId }: Props) {
  const { data: tests, isLoading } = useDemandTests(demandId);
  const runTests = useRunDemandTests(demandId);

  return (
    <div className="cockpit-tab">
      <h2>Tests</h2>
      <button type="button" onClick={() => runTests.mutate()} disabled={runTests.isPending}>
        Run tests
      </button>
      {isLoading && <p>Loading tests…</p>}
      {!isLoading && !tests?.length && <p>No test executions yet.</p>}
      {!!tests?.length && (
        <ul className="test-list">
          {tests.map((t) => (
            <li key={t.id}>
              <strong>{t.suite}</strong> — {t.status}
              {t.result &&
                ` (${t.result.passedCount} passed, ${t.result.failedCount} failed, ${t.result.skippedCount} skipped)`}
              {t.error && <p className="form-error">{t.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
