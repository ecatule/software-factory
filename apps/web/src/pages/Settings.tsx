import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ApiError,
  useProviderConfigurations,
  useProvidersList,
  useSaveProviderConfiguration,
  type Provider,
} from "../services/useProviders";

interface ConfigFormValues {
  projectId: string;
  pipelineStage: string;
  model: string;
}

/**
 * spec User Story 15: Provider catalog + non-secret configuration.
 * Deliberately exposes only named, non-secret fields (project/pipeline
 * stage/model) rather than a generic free-text value box — see
 * contracts/settings.md.
 */
export function Settings() {
  const { data: providers, isLoading } = useProvidersList();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const { data: configurations } = useProviderConfigurations(selectedProviderId);
  const saveConfiguration = useSaveProviderConfiguration();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ConfigFormValues>();

  const columns: ColumnDef<Provider, unknown>[] = [
    { header: "Key", accessorKey: "key" },
    { header: "Kind", accessorKey: "kind" },
  ];

  async function onSubmit(values: ConfigFormValues) {
    if (!selectedProviderId) return;
    setSaveError(null);
    try {
      await saveConfiguration.mutateAsync({
        providerId: selectedProviderId,
        projectId: values.projectId || undefined,
        pipelineStage: values.pipelineStage || undefined,
        settings: values.model ? { model: values.model } : {},
      });
      reset();
    } catch (error) {
      if (error instanceof ApiError) {
        setSaveError((error.body as { message?: string })?.message ?? "Save rejected.");
      } else {
        setSaveError("Unexpected error saving the configuration.");
      }
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings — Providers</h1>

      <DataTable
        columns={columns}
        data={providers ?? []}
        isLoading={isLoading}
        onRowClick={(p) => setSelectedProviderId(p.id)}
      />

      {selectedProviderId && (
        <section>
          <h2>Configurations</h2>
          <ul>
            {configurations?.items.map((c) => (
              <li key={c.id}>
                {c.projectId ?? "platform-default"} / {c.pipelineStage ?? "any stage"} —{" "}
                {JSON.stringify(c.settings)}
              </li>
            ))}
          </ul>

          <form onSubmit={handleSubmit(onSubmit)}>
            {saveError && <p className="form-error">{saveError}</p>}
            <FormField label="Project ID (optional)" registration={register("projectId")} />
            <FormField label="Pipeline stage (optional)" registration={register("pipelineStage")} />
            <FormField label="Model (optional, non-secret)" registration={register("model")} />
            <button type="submit">Save configuration</button>
          </form>
        </section>
      )}
    </div>
  );
}
