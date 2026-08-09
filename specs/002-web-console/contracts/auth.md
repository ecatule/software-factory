# Contract: Authentication

Base path: `/api/v1/auth`. Implements spec FR-001, FR-004, FR-005.

## `GET /auth/login`

- **Query params**: `redirect?` (where to send the user in the SPA after a successful sign-in;
  defaults to `/`).
- **302**: redirects the browser to the configured OIDC provider's authorization endpoint,
  with PKCE `code_challenge` and a signed `state` (encoding `redirect`) generated server-side.

## `GET /auth/callback`

- **Query params** (set by the IdP): `code`, `state`.
- Exchanges `code` for tokens against the IdP (server-side, via `openid-client`), resolves the
  platform `User` by the IdP-verified email/subject (spec 001's `AuthService.
  issueTokensForVerifiedIdentity`), and issues the platform's own access/refresh JWTs.
- **302**: sets the refresh token as an httpOnly, Secure, `SameSite=Lax` cookie, then redirects
  to the SPA's `redirect` path (decoded from `state`). The access token is NOT included in the
  redirect URL (would leak via browser history/referrer) — the SPA retrieves it via
  `GET /auth/session` immediately after landing.
- **401** (rendered as an error page, not a redirect): unknown identity (no matching `User`) or
  IdP error — spec Edge Cases: "Login attempt fails... clear, actionable message."

## `GET /auth/session`

- Reads the httpOnly refresh cookie, validates it, and — if valid — mints a fresh access token
  without requiring the user to re-authenticate.
- **200**: `{ accessToken: string, user: { id, email, roles } }`.
- **401**: no valid refresh cookie present — the SPA routes to `/login`.

## `POST /auth/refresh` (unchanged from 001)

- Existing 001 endpoint; the frontend does not call this directly now — the httpOnly cookie
  is refreshed transparently by the backend when `/auth/session` runs. Kept for
  service-to-service or non-browser callers that manage their own refresh token explicitly.

## `POST /auth/logout`

- Clears the refresh cookie server-side (sets it expired). **204**.

## Frontend contract

`AuthContext` calls `GET /auth/session` once on app load (and after a 401 from any API call)
to (re)acquire an access token; if that fails, `ProtectedRoute` redirects to
`GET /auth/login?redirect=<current path>`.
