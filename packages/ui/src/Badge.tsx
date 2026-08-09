export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

/** Used for demand/execution/test statuses across every list screen. */
export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
