import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useClientsList } from "../services/useClients";
import { useCreateProject, useProjectsList, useUpdateProject } from "../services/useProjects";
import type { Project } from "../services/types";

interface ProjectFormValues {
  clientId: string;
  name: string;
  requiredTestSuites: string;
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
    reset({ clientId: clientFilter || "", name: "", requiredTestSuites: "" });
    setIsCreating(true);
  }

  function openEdit(project: Project) {
    reset({
      clientId: project.clientId,
      name: project.name,
      requiredTestSuites: project.requiredTestSuites.join(", "),
    });
    setEditing(project);
  }

  async function onSubmit(values: ProjectFormValues) {
    const requiredTestSuites = splitSuites(values.requiredTestSuites);
    if (editing) {
      await updateProject.mutateAsync({ id: editing.id, name: values.name, requiredTestSuites });
      setEditing(null);
    } else {
      await createProject.mutateAsync({
        clientId: values.clientId,
        name: values.name,
        requiredTestSuites,
      });
      setIsCreating(false);
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
          <button type="submit">Save</button>
        </form>
      </Modal>
    </div>
  );
}
