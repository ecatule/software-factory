import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemandTests, useRunDemandTests } from "../../services/useDemandTests";

interface Props {
  demandId: string;
}

/** feature 004 US5: per-demand test executions, previously only reachable via the cross-demand Tests page. */
export function TestsTab({ demandId }: Props) {
  const { data: tests, isLoading } = useDemandTests(demandId);
  const runTests = useRunDemandTests(demandId);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Tests</h2>
      <Button type="button" onClick={() => runTests.mutate()} disabled={runTests.isPending} className="self-start">
        <PlayCircle /> Run tests
      </Button>
      {isLoading && <p className="text-sm text-muted-foreground">Loading tests…</p>}
      {!isLoading && !tests?.length && <p className="text-sm text-muted-foreground">No test executions yet.</p>}
      {!!tests?.length && (
        <ul className="flex flex-col gap-2">
          {tests.map((t) => (
            <li key={t.id} className="text-sm text-foreground">
              <strong className="font-semibold">{t.suite}</strong> — {t.status}
              {t.result &&
                ` (${t.result.passedCount} passed, ${t.result.failedCount} failed, ${t.result.skippedCount} skipped)`}
              {t.error && <p className="mt-1 text-sm font-medium text-destructive">{t.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
