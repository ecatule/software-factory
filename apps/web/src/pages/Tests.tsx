import { useState } from "react";
import { Badge } from "@software-factory/ui";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { useDemandTests, useRunDemandTests } from "../services/useDemandTests";
import { useDemandsList } from "../services/useDemands";

/** spec User Story 11: per-demand test results (not cross-demand, per spec.md). */
export function Tests() {
  const [demandId, setDemandId] = useState<string | null>(null);
  const { data: demands } = useDemandsList({ pageSize: 100 });
  const { data: tests, isLoading } = useDemandTests(demandId);
  const runTests = useRunDemandTests(demandId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Tests</h1>

      <div className="flex max-w-sm flex-col gap-1.5">
        <label htmlFor="demandId" className="text-sm font-medium text-foreground">
          Demand
        </label>
        <NativeSelect id="demandId" value={demandId ?? ""} onChange={(e) => setDemandId(e.target.value || null)}>
          <option value="">Select a demand…</option>
          {demands?.items.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </NativeSelect>
      </div>

      {demandId && (
        <>
          <Button type="button" onClick={() => runTests.mutate()} disabled={runTests.isPending} className="self-start">
            <PlayCircle /> Run required suites
          </Button>

          {isLoading && <p className="text-sm text-muted-foreground">Loading test results…</p>}
          <ul className="flex flex-col gap-3">
            {tests?.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Badge
                    label={t.status}
                    tone={t.status === "FAILED" ? "danger" : t.status === "PASSED" ? "success" : "neutral"}
                  />
                  <span>{t.suite}</span>
                  {t.result && (
                    <span className="text-muted-foreground">
                      ({t.result.passedCount} passed, {t.result.failedCount} failed, {t.result.skippedCount} skipped)
                    </span>
                  )}
                </div>
                {t.status === "FAILED" && t.error && (
                  <pre className="overflow-x-auto rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {t.error}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
