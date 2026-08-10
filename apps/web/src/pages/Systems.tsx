import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { DataTable, FormField, Modal, Badge } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
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
    { header: "Name", accessorKey: "name" },
    { header: "Description", accessorKey: "description" },
    { header: "Status", cell: ({ row }) => <Badge label={row.original.stAtivo ? "ACTIVE" : "INACTIVE"} /> },
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
    <div className="systems-page">
      <header>
        <h1>Sistemas</h1>
        {hasPermission("SYSTEM_WRITE") && (
          <button type="button" onClick={openCreate}>
            New system
          </button>
        )}
      </header>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(system) => navigate(`/systems/${system.id}`)}
        emptyMessage="No systems yet."
      />

      <Modal title="New system" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField label="Description" type="textarea" registration={register("description")} />
          <button type="submit">Create</button>
        </form>
      </Modal>
    </div>
  );
}
