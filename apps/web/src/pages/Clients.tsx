import { useState } from "react";
import { useForm } from "react-hook-form";
import { DataTable, FormField, Modal } from "@software-factory/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useClientsList, useCreateClient, useUpdateClient } from "../services/useClients";
import type { Client } from "../services/types";

interface ClientFormValues {
  name: string;
  externalReference?: string;
}

/** spec User Story 3: list, create, and edit Clients. */
export function Clients() {
  const { data: clients, isLoading } = useClientsList();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const [editing, setEditing] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { register, handleSubmit, reset } = useForm<ClientFormValues>();

  const columns: ColumnDef<Client, unknown>[] = [
    { header: "Name", accessorKey: "name" },
    { header: "External reference", accessorKey: "externalReference" },
  ];

  function openCreate() {
    reset({ name: "", externalReference: "" });
    setIsCreating(true);
  }

  function openEdit(client: Client) {
    reset({ name: client.name, externalReference: client.externalReference ?? "" });
    setEditing(client);
  }

  async function onSubmit(values: ClientFormValues) {
    if (editing) {
      await updateClient.mutateAsync({ id: editing.id, ...values });
      setEditing(null);
    } else {
      await createClient.mutateAsync(values);
      setIsCreating(false);
    }
  }

  return (
    <div className="clients-page">
      <header>
        <h1>Clients</h1>
        <button type="button" onClick={openCreate}>
          New client
        </button>
      </header>

      <DataTable
        columns={columns}
        data={clients ?? []}
        isLoading={isLoading}
        onRowClick={openEdit}
        emptyMessage="No clients yet — create one to get started."
      />

      <Modal
        title={editing ? "Edit client" : "New client"}
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setIsCreating(false);
          setEditing(null);
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" registration={register("name", { required: true })} />
          <FormField
            label="External reference"
            registration={register("externalReference")}
          />
          <button type="submit">Save</button>
        </form>
      </Modal>
    </div>
  );
}
