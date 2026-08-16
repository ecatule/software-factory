import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CircleDot,
  Code2,
  FileText,
  FlaskConical,
  GitPullRequest,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/ui/bar-chart";
import { AreaChart } from "@/components/ui/area-chart";
import { cn } from "@/lib/utils";
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  if (isError || !data) return <p className="text-sm text-destructive">Failed to load dashboard.</p>;

  function goToDemands(query: string) {
    navigate(`/demands?${query}`);
  }

  const kpis: { label: string; value: number; icon: LucideIcon; query: string; accent?: string }[] = [
    { label: "Total demands", value: data.totals.all, icon: ListChecks, query: "" },
    { label: "Open", value: data.totals.open, icon: CircleDot, query: `status_in=${BUCKET_STATUSES.open}` },
    {
      label: "In specification",
      value: data.totals.inSpecification,
      icon: FileText,
      query: `status_in=${BUCKET_STATUSES.inSpecification}`,
    },
    {
      label: "In development",
      value: data.totals.inDevelopment,
      icon: Code2,
      query: `status_in=${BUCKET_STATUSES.inDevelopment}`,
    },
    {
      label: "Blocked",
      value: data.totals.blocked,
      icon: AlertTriangle,
      query: `status_in=${BUCKET_STATUSES.blocked}`,
      accent: "text-destructive",
    },
    { label: "PRs open", value: data.pullRequestsOpen, icon: GitPullRequest, query: "pr_status=OPEN" },
    {
      label: "Tests failing",
      value: data.testsFailing,
      icon: FlaskConical,
      query: "has_failing_tests=true",
      accent: data.testsFailing > 0 ? "text-destructive" : undefined,
    },
    { label: "Agents running", value: data.agentsRunning, icon: Bot, query: "agent_status=RUNNING" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Atividade dos últimos 7 dias</CardTitle>
          <CardDescription>Total de ações registradas por dia em todo o sistema</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-4xl font-bold tracking-tight text-foreground">
            {data.dailyActivity.reduce((sum, d) => sum + d.count, 0)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">ações nos últimos 7 dias</span>
          </p>
          <AreaChart data={data.dailyActivity.map((d) => ({ name: d.label, value: d.count }))} />
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer transition-colors hover:bg-accent/50"
            onClick={() => goToDemands(kpi.query)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <kpi.icon className={cn("size-5 shrink-0 text-muted-foreground", kpi.accent)} />
              <div>
                <p className={cn("text-2xl font-bold leading-none text-foreground", kpi.accent)}>{kpi.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demands by client</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.byClient.map((c) => ({ name: c.clientName, value: c.count }))}
              onValueClick={(d) => {
                const client = data.byClient.find((c) => c.clientName === d.name);
                if (client) goToDemands(`client_id=${client.clientId}`);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demands by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.stageCounts.map((s) => ({ name: s.stage, value: s.count }))}
              onValueClick={(d) => goToDemands(`status=${d.name}`)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average time per stage</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.avgTimePerStage.map((s) => ({ name: s.stage, value: Number(s.avgHours.toFixed(1)) }))}
              valueFormatter={(v) => `${v}h`}
              onValueClick={(d) => goToDemands(`status=${d.name}`)}
            />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recently updated demands
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {data.recentDemands.map((demand) => (
            <li key={demand.id}>
              <Link
                to={`/demands/${demand.id}`}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/50"
              >
                <span>{demand.title}</span>
                <span className="text-muted-foreground">{demand.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
