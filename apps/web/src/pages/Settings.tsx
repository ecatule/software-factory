import { useEffect, useState } from "react";
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
import {
  usePermissionsList,
  useRolePermissions,
  useRolesList,
  useSetRolePermissions,
  type Role,
} from "../services/useRoles";

interface ConfigFormValues {
  projectId: string;
  pipelineStage: string;
  model: string;
  authProfileKey: string;
}

/**
 * spec User Story 15: Provider catalog + non-secret configuration.
 * Deliberately exposes only named, non-secret fields (project/pipeline
 * stage/model/auth profile) rather than a generic free-text value box — see
 * contracts/settings.md. `authProfileKey` is just a label (e.g. "default",
 * "personal", "work") picking one of the env-only credential profiles
 * `ProviderConfigurationResolver`/`SpecKitProvider` resolve server-side —
 * the actual credential never reaches this form or the database.
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
      const settings: Record<string, unknown> = {};
      if (values.model) settings.model = values.model;
      if (values.authProfileKey) settings.authProfileKey = values.authProfileKey;
      await saveConfiguration.mutateAsync({
        providerId: selectedProviderId,
        projectId: values.projectId || undefined,
        pipelineStage: values.pipelineStage || undefined,
        settings,
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
            <FormField
              label="Auth profile (optional, e.g. default)"
              registration={register("authProfileKey")}
            />
            <button type="submit">Save configuration</button>
          </form>
        </section>
      )}

      <RolePermissions />
    </div>
  );
}

/** feature 004 User Story 2 (FR-005): assign granular permissions to a role. */
function RolePermissions() {
  const { data: roles } = useRolesList();
  const { data: allPermissions } = usePermissionsList();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const { data: assigned } = useRolePermissions(selectedRoleId);
  const setPermissions = useSetRolePermissions(selectedRoleId ?? "");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (assigned) setSelected(assigned.map((p) => p.name));
  }, [assigned]);

  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name) ? current.filter((p) => p !== name) : [...current, name],
    );
  }

  const roleColumns: ColumnDef<Role, unknown>[] = [
    { header: "Role", accessorKey: "name" },
    { header: "Description", accessorKey: "description" },
  ];

  return (
    <section>
      <h2>Roles &amp; Permissions</h2>
      <DataTable
        columns={roleColumns}
        data={roles ?? []}
        onRowClick={(role) => setSelectedRoleId(role.id)}
      />

      {selectedRoleId && (
        <div>
          <ul>
            {allPermissions?.map((permission) => (
              <li key={permission.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(permission.name)}
                    onChange={() => toggle(permission.name)}
                  />{" "}
                  {permission.name}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setPermissions.mutate(selected)}>
            Save permissions
          </button>
        </div>
      )}
    </section>
  );
}
