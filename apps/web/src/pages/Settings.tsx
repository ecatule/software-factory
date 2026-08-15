import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import {
  ApiError,
  useAuthProfilesList,
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
  const { data: authProfiles } = useAuthProfilesList();
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
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings — Providers</h1>

      <DataTable columns={columns} data={providers ?? []} isLoading={isLoading} onRowClick={(p) => setSelectedProviderId(p.id)} />

      {selectedProviderId && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Configurations</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-foreground">
            {configurations?.items.map((c) => {
              const profile =
                typeof c.settings.authProfileKey === "string" ? c.settings.authProfileKey : null;
              const model = typeof c.settings.model === "string" ? c.settings.model : null;
              return (
                <li key={c.id}>
                  {c.projectId ?? "platform-default"} / {c.pipelineStage ?? "any stage"}
                  {profile && <> — Perfil: {profile}</>}
                  {model && <> — Model: {model}</>}
                  {!profile && !model && <> — {JSON.stringify(c.settings)}</>}
                </li>
              );
            })}
          </ul>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {saveError && <p className="text-sm font-medium text-destructive">{saveError}</p>}
            <FormField label="Project ID (optional)" registration={register("projectId")} />
            <FormField label="Pipeline stage (optional)" registration={register("pipelineStage")} />
            <FormField label="Model (optional, non-secret)" registration={register("model")} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="authProfileKey" className="text-sm font-medium text-foreground">
                Auth profile (opcional)
              </label>
              {/* follow-up: was a free-text field — the admin had to already
                  know the exact profile name configured on the server's
                  .env, with no feedback on typos (silently falls back to
                  the default session). Now a dropdown of the profiles that
                  actually exist right now (GET /providers/auth-profiles —
                  names only, never the credential). */}
              <NativeSelect id="authProfileKey" {...register("authProfileKey")}>
                <option value="">(nenhum — sessão padrão do servidor)</option>
                {authProfiles?.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" className="self-start">
              Save configuration
            </Button>
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
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Roles &amp; Permissions</h2>
      <DataTable columns={roleColumns} data={roles ?? []} onRowClick={(role) => setSelectedRoleId(role.id)} />

      {selectedRoleId && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {allPermissions?.map((permission) => (
              <li key={permission.id}>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selected.includes(permission.name)}
                    onChange={() => toggle(permission.name)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  {permission.name}
                </label>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setPermissions.mutate(selected)}>
            Save permissions
          </Button>
        </div>
      )}
    </section>
  );
}
