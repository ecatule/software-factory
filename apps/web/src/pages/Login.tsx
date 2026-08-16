import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "../context/AuthContext";

/** spec User Story 1: the only unauthenticated screen — triggers the OIDC redirect. */
export function Login() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <Logo variant="full" height={36} />
      <p className="text-muted-foreground">Entre com sua identidade organizacional para continuar.</p>
      <Button type="button" size="lg" onClick={() => login(redirect)}>
        Entrar
      </Button>
    </div>
  );
}
