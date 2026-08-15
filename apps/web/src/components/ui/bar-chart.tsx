import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface BarChartDatum {
  name: string;
  value: number;
}

interface BarChartProps {
  data: BarChartDatum[];
  className?: string;
  /** Called when a bar is clicked — used to deep-link into the filtered Demands list. */
  onValueClick?: (datum: BarChartDatum) => void;
  valueFormatter?: (value: number) => string;
}

/**
 * follow-up: visual redesign — Fase 2c. Modeled on Tremor Raw's `BarChart`
 * public API (`data`/`index`/`categories` shape simplified to a single
 * series here, since every Dashboard chart is one metric per category) so
 * it's swappable for the real Tremor Raw component later without touching
 * call sites. Backed directly by `recharts` (Tremor Raw's own dependency),
 * styled with our CSS variable tokens instead of copying Tremor's full
 * component (tooltip/legend/accessibility) verbatim.
 */
export function BarChart({ data, className, onValueClick, valueFormatter }: BarChartProps) {
  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              color: "var(--card-foreground)",
            }}
            formatter={(value) =>
              valueFormatter && typeof value === "number" ? valueFormatter(value) : value
            }
          />
          <Bar
            dataKey="value"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            cursor={onValueClick ? "pointer" : undefined}
            onClick={(entry) => onValueClick?.(entry as unknown as BarChartDatum)}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
