import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "./api";

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export function useRolesList() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGet<Role[]>("/roles"),
  });
}

export function usePermissionsList() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiGet<Permission[]>("/permissions"),
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: ["roles", roleId, "permissions"],
    queryFn: () => apiGet<Permission[]>(`/roles/${roleId}/permissions`),
    enabled: roleId !== null,
  });
}

export function useSetRolePermissions(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionNames: string[]) =>
      apiPut<Permission[]>(`/roles/${roleId}/permissions`, { permissionNames }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles", roleId, "permissions"] }),
  });
}
