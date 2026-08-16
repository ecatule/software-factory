import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { cn } from "./cn";

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
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  // Opt-in: only columns that declare an explicit `size` get a fixed pixel
  // width (via <colgroup>) — lets a caller align matching columns (e.g. the
  // same "Ações" column) across several separate <table> instances. Callers
  // that never set `size` keep the previous auto-layout behavior untouched.
  const hasExplicitColumnSizes = columns.some((c) => c.size !== undefined);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full text-sm", hasExplicitColumnSizes && "table-fixed")}>
        {hasExplicitColumnSizes && (
          <colgroup>
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <col
                key={header.id}
                style={header.column.columnDef.size !== undefined ? { width: header.column.columnDef.size } : undefined}
              />
            ))}
          </colgroup>
        )}
        <thead className="border-b border-border bg-secondary/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="truncate px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(onRowClick && "cursor-pointer transition-colors hover:bg-accent/50")}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="truncate px-4 py-2.5 text-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
