import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface AreaChartDatum {
  name: string;
  value: number;
}

interface AreaChartProps {
  data: AreaChartDatum[];
  className?: string;
  valueFormatter?: (value: number) => string;
}

/**
 * follow-up: Dashboard highlight ("Atividade dos últimos 7 dias") —
 * first line/area chart in the codebase (bar-chart.tsx was the only
 * wrapper before this). `type="monotone"` on `Area` is what gives the
 * smooth curve (vs. straight `type="linear"` segments) — the whole
 * point of this component vs. reusing `BarChart`. Same token/tooltip
 * styling convention as `bar-chart.tsx`.
 */
export function AreaChart({ data, className, valueFormatter }: AreaChartProps) {
  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="area-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              color: "var(--card-foreground)",
            }}
            formatter={(value) => (valueFormatter && typeof value === "number" ? valueFormatter(value) : value)}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#area-chart-fill)"
            dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
