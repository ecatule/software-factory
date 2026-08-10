import type { PropsWithChildren } from "react";

export interface ModalProps extends PropsWithChildren {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  /** Extra class on the `.modal` panel — e.g. "modal-wide" for content-heavy screens. */
  className?: string;
}

export function Modal({ title, isOpen, onClose, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={className ? `modal ${className}` : "modal"}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
