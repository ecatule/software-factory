import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

/**
 * Thin wrapper around @tanstack/react-table's headless core — every console
 * list screen (Clients, Projects, Demands, Workspaces, ...) renders through
 * this one component so table markup/behavior stays consistent.
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No records found.",
  onRowClick,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <p className="data-table-loading">Loading…</p>;
  }

  if (data.length === 0) {
    return <p className="data-table-empty">{emptyMessage}</p>;
  }

  return (
    <table className="data-table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            className={onRowClick ? "data-table-row-clickable" : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
