import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
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
  productionBranch: string;
  homologationBranch: string;
  homologationEnvironment: string;
  productionEnvironment: string;
}

function splitSuites(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
      productionBranch: "",
      homologationBranch: "",
      homologationEnvironment: "",
      productionEnvironment: "",
    });
    setSaveError(null);
    setIsCreating(true);
  }

  function openEdit(project: Project) {
    reset({
      clientId: project.clientId,
      name: project.name,
      requiredTestSuites: project.requiredTestSuites.join(", "),
      productionBranch: project.productionBranch ?? "",
      homologationBranch: project.homologationBranch ?? "",
      homologationEnvironment: project.homologationEnvironment ?? "",
      productionEnvironment: project.productionEnvironment ?? "",
    });
    setSaveError(null);
    setEditing(project);
  }

  async function onSubmit(values: ProjectFormValues) {
    setSaveError(null);
    const requiredTestSuites = splitSuites(values.requiredTestSuites);
    const branchFields = {
      productionBranch: values.productionBranch,
      homologationBranch: values.homologationBranch,
      homologationEnvironment: values.homologationEnvironment,
      productionEnvironment: values.productionEnvironment,
    };
    try {
      if (editing) {
        await updateProject.mutateAsync({
          id: editing.id,
          name: values.name,
          requiredTestSuites,
          ...branchFields,
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
    <div className="projects-page">
      <header>
        <h1>Projects</h1>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={openCreate}>
          New project
        </button>
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
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {saveError && <p className="form-error">{saveError}</p>}
          {!editing && (
            <div className="form-field">
              <label htmlFor="clientId">Client</label>
              <select id="clientId" {...register("clientId", { required: true })}>
                <option value="">Select a client…</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField
            label="Required test suites (comma-separated)"
            registration={register("requiredTestSuites")}
          />
          {editing && (
            <>
              <FormField label="Production branch" registration={register("productionBranch")} />
              <FormField
                label="Homologation branch"
                registration={register("homologationBranch")}
              />
              <FormField
                label="Homologation environment"
                registration={register("homologationEnvironment")}
              />
              <FormField
                label="Production environment"
                registration={register("productionEnvironment")}
              />
            </>
          )}
          <button type="submit">Save</button>
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
    <section>
      <h2>Technologies</h2>
      <ul>
        {allTechnologies?.items.map((tech) => (
          <li key={tech.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(tech.id)}
                onChange={() => toggle(tech.id)}
              />{" "}
              {tech.name}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setTechnologies.mutate(selected, { onSuccess: onSaved })}
      >
        Save technologies
      </button>
    </section>
  );
}
