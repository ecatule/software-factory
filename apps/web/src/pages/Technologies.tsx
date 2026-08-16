import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import {
  useCreateTechnology,
  useTechnologiesList,
  useUpdateTechnology,
  type Technology,
} from "../services/useTechnologies";

interface TechnologyFormValues {
  name: string;
  category: string;
  techVersion?: string;
  description?: string;
  status?: string;
}

/** spec User Story 2: catalog technologies and (via Projects.tsx) associate them with a project. */
export function Technologies() {
  const { data, isLoading } = useTechnologiesList();
  const createTechnology = useCreateTechnology();
  const updateTechnology = useUpdateTechnology();
  const [editing, setEditing] = useState<Technology | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<TechnologyFormValues>();

  const columns: ColumnDef<Technology, unknown>[] = [
    { header: "Nome", accessorKey: "name" },
    { header: "Categoria", accessorKey: "category" },
    { header: "Versão", accessorKey: "techVersion" },
    {
      header: "Status",
      cell: ({ row }) =>
        row.original.status === "ACTIVE" ? "Ativo" : row.original.status === "INACTIVE" ? "Inativo" : row.original.status,
    },
  ];

  function openCreate() {
    reset({ name: "", category: "", techVersion: "", description: "", status: "ACTIVE" });
    setIsCreating(true);
  }

  function openEdit(technology: Technology) {
    reset({
      name: technology.name,
      category: technology.category,
      techVersion: technology.techVersion ?? "",
      description: technology.description ?? "",
      status: technology.status,
    });
    setEditing(technology);
  }

  async function onSubmit(values: TechnologyFormValues) {
    if (editing) {
      await updateTechnology.mutateAsync({ id: editing.id, ...values });
      setEditing(null);
    } else {
      await createTechnology.mutateAsync(values as Omit<Technology, "id">);
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tecnologias</h1>
        <Button type="button" onClick={openCreate}>
          <Plus /> Nova tecnologia
        </Button>
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="Nenhuma tecnologia ainda — crie uma para começar."
      />

      <Modal
        title={editing ? "Editar tecnologia" : "Nova tecnologia"}
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setIsCreating(false);
          setEditing(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Nome" registration={register("name", { required: true })} />
          <FormField label="Categoria" registration={register("category", { required: true })} />
          <FormField label="Versão" registration={register("techVersion")} />
          <FormField label="Descrição" type="textarea" registration={register("description")} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-sm font-medium text-foreground">
              Status
            </label>
            <NativeSelect id="status" {...register("status")}>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </NativeSelect>
          </div>
          <Button type="submit" className="self-start">
            Salvar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
