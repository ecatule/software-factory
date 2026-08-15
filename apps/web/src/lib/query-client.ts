import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/services/api";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | undefined;
    if (Array.isArray(body?.message)) return body.message.join(", ");
    if (typeof body?.message === "string") return body.message;
  }
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

/**
 * follow-up: visual redesign — global save feedback via toast (user
 * request, 2026-08-15), wired once here via React Query's `MutationCache`
 * instead of touching every individual `useMutation` call in
 * `src/services/*` (there are dozens). Every mutation across the app gets
 * a toast automatically; a specific mutation can opt out (e.g. it already
 * has its own dedicated feedback UI) with `meta: { silentToast: true }`,
 * or override the success copy with `meta: { successMessage: "..." }`.
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.silentToast) return;
      const message = (mutation.meta?.successMessage as string | undefined) ?? "Salvo com sucesso.";
      toast.success(message);
    },
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silentToast) return;
      toast.error(errorMessage(error));
    },
  }),
});
