import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { apiGet, setAccessToken } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  /** feature 004 (contracts/permissions.md): checked by hasPermission() for FR-007a. */
  permissions: string[];
}

interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "signed-in" | "signed-out";
  login: (redirect?: string) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * spec 002 US1/research.md §3: on load (and whenever a session needs
 * re-acquiring), calls GET /auth/session to silently mint an access token
 * from the httpOnly refresh cookie — the SPA never reads or stores the
 * refresh token itself.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const bootstrapSession = useCallback(async () => {
    try {
      const session = await apiGet<SessionResponse>("/auth/session");
      setAccessToken(session.accessToken);
      setUser(session.user);
      setStatus("signed-in");
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus("signed-out");
    }
  }, []);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    // The access token expires in JWT_ACCESS_EXPIRES_IN (15m by default) and
    // was previously only ever minted once, on page load — any tab left open
    // longer than that started getting silent 401s on every write, with no
    // error surfaced anywhere. Re-mint it well inside that window using the
    // same httpOnly refresh cookie bootstrapSession() already relies on.
    const interval = setInterval(() => void bootstrapSession(), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [bootstrapSession]);

  const login = useCallback((redirect = "/") => {
    window.location.href = `${API_BASE_URL}/api/v1/auth/login?redirect=${encodeURIComponent(redirect)}`;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    setAccessToken(null);
    setUser(null);
    setStatus("signed-out");
  }, []);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, status, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
