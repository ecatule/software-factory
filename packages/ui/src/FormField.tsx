import type { UseFormRegisterReturn } from "react-hook-form";

export interface FormFieldProps {
  label: string;
  error?: string;
  type?: "text" | "email" | "number" | "textarea";
  registration: UseFormRegisterReturn;
}

/** A labeled input/textarea wired to a react-hook-form `register()` call, with an error slot. */
export function FormField({ label, error, type = "text", registration }: FormFieldProps) {
  const id = registration.name;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {type === "textarea" ? (
        <textarea id={id} {...registration} />
      ) : (
        <input id={id} type={type} {...registration} />
      )}
      {error ? <span className="form-field-error">{error}</span> : null}
    </div>
  );
}
