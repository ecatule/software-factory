import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { DataTable, FormField, Modal, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useCreateSystem, useSystemsList, type System } from "../services/useSystems";

interface SystemFormValues {
  name: string;
  description: string;
}

/**
 * feature 005 User Story 1: catálogo técnico reutilizável de Sistemas e seus Artefatos —
 * independente de Projects/Artifacts (Clarifications 2026-08-10). follow-up: editing a
 * System (and its potentially hundreds of Artefatos) is a dedicated page
 * (`SystemDetail.tsx`), not a modal — this screen is just the list + quick create.
 */
export function Systems() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data, isLoading } = useSystemsList();
  const createSystem = useCreateSystem();
  const [isCreating, setIsCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<SystemFormValues>();

  const columns: ColumnDef<System, unknown>[] = [
    { header: "Nome", accessorKey: "name" },
    { header: "Descrição", accessorKey: "description" },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge label={row.original.stAtivo ? "ATIVO" : "INATIVO"} tone={row.original.stAtivo ? "success" : "neutral"} />
      ),
    },
  ];

  function openCreate() {
    reset({ name: "", description: "" });
    setIsCreating(true);
  }

  async function onSubmit(values: SystemFormValues) {
    const system = await createSystem.mutateAsync(values);
    setIsCreating(false);
    navigate(`/systems/${system.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sistemas</h1>
        {hasPermission("SYSTEM_WRITE") && (
          <Button type="button" onClick={openCreate}>
            <Plus /> Novo sistema
          </Button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(system) => navigate(`/systems/${system.id}`)}
        emptyMessage="Nenhum sistema ainda."
      />

      <Modal title="Novo sistema" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Nome" registration={register("name", { required: true })} />
          <FormField label="Descrição" type="textarea" registration={register("description")} />
          <Button type="submit" className="self-start">
            Criar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
