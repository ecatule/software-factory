import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { ApiError } from "../services/api";
import { useClientsList } from "../services/useClients";
import { useCreateProject, useProjectsList, useUpdateProject } from "../services/useProjects";
import {
  useProjectTechnologies,
  useSetProjectTechnologies,
  useTechnologiesList,
} from "../services/useTechnologies";
import type { Project } from "../services/types";

interface ProjectFormValues {
  clientId: string;
  name: string;
  requiredTestSuites: string;
  constitution: string;
}

function splitSuites(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const textareaClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** spec User Story 4: list (filterable by client), create, and edit Projects. */
export function Projects() {
  const [clientFilter, setClientFilter] = useState<string>("");
  const { data: clients } = useClientsList();
  const { data: projects, isLoading } = useProjectsList(clientFilter || undefined);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [editing, setEditing] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ProjectFormValues>();

  const columns: ColumnDef<Project, unknown>[] = [
    { header: "Name", accessorKey: "name" },
    {
      header: "Client",
      accessorFn: (row) => clients?.find((c) => c.id === row.clientId)?.name ?? row.clientId,
    },
    {
      header: "Required test suites",
      accessorFn: (row) => row.requiredTestSuites.join(", "),
    },
  ];

  function openCreate() {
    reset({
      clientId: clientFilter || "",
      name: "",
      requiredTestSuites: "",
      constitution: "",
    });
    setSaveError(null);
    setIsCreating(true);
  }

  function openEdit(project: Project) {
    reset({
      clientId: project.clientId,
      name: project.name,
      requiredTestSuites: project.requiredTestSuites.join(", "),
      constitution: project.constitution ?? "",
    });
    setSaveError(null);
    setEditing(project);
  }

  async function onSubmit(values: ProjectFormValues) {
    setSaveError(null);
    const requiredTestSuites = splitSuites(values.requiredTestSuites);
    try {
      if (editing) {
        await updateProject.mutateAsync({
          id: editing.id,
          name: values.name,
          requiredTestSuites,
          constitution: values.constitution,
        });
        setEditing(null);
      } else {
        await createProject.mutateAsync({
          clientId: values.clientId,
          name: values.name,
          requiredTestSuites,
        });
        setIsCreating(false);
      }
    } catch (error) {
      // Previously unhandled — a failed save (e.g. an expired session) left
      // the modal open with no feedback, indistinguishable from doing
      // nothing. See AuthContext.tsx for the expired-session root cause.
      if (error instanceof ApiError) {
        const message = (error.body as { message?: string })?.message;
        setSaveError(message ?? `Request failed (${error.status}). Try reloading the page.`);
      } else {
        setSaveError("Unexpected error saving the project.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
        <div className="flex items-center gap-2">
          <NativeSelect value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-auto">
            <option value="">All clients</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" onClick={openCreate}>
            <Plus /> New project
          </Button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={projects ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="No projects yet — create one under a client."
      />

      <Modal
        title={editing ? "Edit project" : "New project"}
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setIsCreating(false);
          setEditing(null);
        }}
        className={editing ? "modal-wide" : undefined}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {saveError && <p className="text-sm font-medium text-destructive">{saveError}</p>}
          {!editing && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="clientId" className="text-sm font-medium text-foreground">
                Client
              </label>
              <NativeSelect id="clientId" {...register("clientId", { required: true })}>
                <option value="">Select a client…</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField
            label="Required test suites (comma-separated)"
            registration={register("requiredTestSuites")}
          />
          {editing && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="constitution" className="text-sm font-medium text-foreground">
                Constitution (aplicada em <code>.specify/memory/constitution.md</code> de toda
                demanda deste projeto antes de rodar specify/plan/tasks/implement)
              </label>
              <textarea id="constitution" rows={16} className={textareaClass} {...register("constitution")} />
            </div>
          )}
          <Button type="submit" className="self-start">
            Save
          </Button>
        </form>
        {editing && (
          <ProjectTechnologies projectId={editing.id} onSaved={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}

/** feature 003 FR-015: multi-select technology association, editable once a project exists. */
function ProjectTechnologies({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const { data: allTechnologies } = useTechnologiesList();
  const { data: assigned } = useProjectTechnologies(projectId);
  const setTechnologies = useSetProjectTechnologies(projectId);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (assigned) setSelected(assigned.map((t) => t.id));
  }, [assigned]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-sm font-semibold text-foreground">Technologies</h2>
      <ul className="flex flex-col gap-1.5">
        {allTechnologies?.items.map((tech) => (
          <li key={tech.id}>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selected.includes(tech.id)}
                onChange={() => toggle(tech.id)}
                className="size-4 rounded border-input accent-primary"
              />
              {tech.name}
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setTechnologies.mutate(selected, { onSuccess: onSaved })}
      >
        Save technologies
      </Button>
    </section>
  );
}
