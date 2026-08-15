import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "./cn";

export interface FormFieldProps {
  label: string;
  error?: string;
  type?: "text" | "email" | "number" | "textarea";
  registration: UseFormRegisterReturn;
}

const controlClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A labeled input/textarea wired to a react-hook-form `register()` call, with an error slot. */
export function FormField({ label, error, type = "text", registration }: FormFieldProps) {
  const id = registration.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {type === "textarea" ? (
        <textarea id={id} rows={4} className={cn(controlClass)} {...registration} />
      ) : (
        <input id={id} type={type} className={cn(controlClass)} {...registration} />
      )}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </div>
  );
}
