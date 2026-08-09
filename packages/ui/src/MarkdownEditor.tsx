import Markdown from "react-markdown";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

/** research.md §4: plain textarea + preview — the backend already computes diffs. */
export function MarkdownEditor({ value, onChange, readOnly }: MarkdownEditorProps) {
  return (
    <div className="markdown-editor">
      <textarea
        className="markdown-editor-source"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={20}
      />
      <div className="markdown-editor-preview">
        <Markdown>{value}</Markdown>
      </div>
    </div>
  );
}
