import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** spec User Story 1: the only unauthenticated screen — triggers the OIDC redirect. */
export function Login() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  return (
    <div className="login-page">
      <h1>AI Software Factory</h1>
      <p>Sign in with your organizational identity to continue.</p>
      <button type="button" onClick={() => login(redirect)}>
        Sign in
      </button>
    </div>
  );
}
