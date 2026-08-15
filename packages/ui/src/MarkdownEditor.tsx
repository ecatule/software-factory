import Markdown from "react-markdown";
import { cn } from "./cn";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

/** research.md §4: plain textarea + preview — the backend already computes diffs. */
export function MarkdownEditor({ value, onChange, readOnly }: MarkdownEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <textarea
        className={cn(
          "min-h-[480px] resize-none rounded-lg border border-input bg-card p-4 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          readOnly && "cursor-default bg-secondary",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={20}
      />
      <div className="prose prose-sm dark:prose-invert min-h-[480px] max-w-none overflow-y-auto rounded-lg border border-border bg-card p-4">
        <Markdown>{value}</Markdown>
      </div>
    </div>
  );
}
