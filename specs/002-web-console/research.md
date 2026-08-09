# Phase 0 Research: Web Console — Administrative Screens

`spec.md` deliberately left the concrete UI/auth mechanics open (per its own Assumptions
section). This research resolves those, plus enumerates the backend surface every screen
actually needs — the spec named 3 headline gaps (login, provider listing, repository/
workspace listing), but tracing each FR to a concrete endpoint surfaced 13 total.

## 1. UI building blocks

- **Decision**: `react-hook-form` (forms) + `@tanstack/react-table` (tables, pagination,
  sorting) + hand-rolled presentational primitives in `packages/ui` (Table wrapper, FormField,
  Modal, Badge, NavShell) — not a full design-system framework.
- **Rationale**: the constitution's simplicity/low-operational-cost principle favors composing
  a couple of small, focused, widely-used libraries over adopting a framework (Mantine/Chakra)
  that would dictate styling and pull in a much larger dependency surface for what is,
  screen-by-screen, mostly CRUD lists and forms. `packages/ui` was scaffolded empty in 001
  specifically for shared presentational components — this is that package's first real use.
- **Alternatives considered**: Mantine or Chakra UI (rejected — heavier footprint and more
  opinionated theming than an internal admin console needs); fully hand-rolled forms and
  tables with zero libraries (rejected — real correctness/productivity cost across 15 screens,
  e.g. re-implementing accessible pagination and form validation wiring from scratch).

## 2. OIDC login flow

- **Decision**: Authorization Code + PKCE, mediated entirely by `apps/api` via the
  `openid-client` package. The browser is redirected to the identity provider, comes back with
  a code, and `apps/api` exchanges that code for tokens server-side — the browser never talks
  to the IdP's token endpoint or holds a client secret.
- **Rationale**: this is the standard secure pattern for a SPA-plus-real-backend, and it keeps
  the same shape as the constitution's "external calls happen in the backend" principle,
  extended naturally to human authentication. It also finally implements what 001's
  `AuthService`/`JwtStrategy` were built for but never wired up (research.md §7 in 001
  explicitly left the IdP choice open — this doesn't need to pick a specific IdP, only the
  protocol flow, which `openid-client` implements against any standard OIDC provider).
- **Alternatives considered**: `passport-openidconnect` (older, less actively maintained than
  `openid-client`, which is the reference implementation used by the OpenID Foundation's own
  certification suite); a fully client-side PKCE flow with no backend mediation (rejected — it
  would sideline the JWT/refresh-token model 001 already built and require the SPA to manage
  provider tokens directly).

## 3. Token storage

- **Decision**: access token kept in memory only (React context), refresh token in an httpOnly
  Secure cookie set by `apps/api` at `/auth/callback` and rotated at `/auth/refresh`. On page
  load, the SPA calls `GET /auth/session`, which uses the httpOnly cookie to silently mint a
  fresh access token.
- **Rationale**: 001's `apps/web/src/services/api.ts` read the access token from
  `localStorage` — acceptable as a stopgap when there was no real login, but now that sign-in
  is real, an XSS bug would otherwise be able to read a long-lived credential straight out of
  `localStorage`. An httpOnly cookie isn't reachable from JS at all, so moving the
  longer-lived refresh token there measurably reduces that blast radius; keeping the
  short-lived access token in memory (lost on hard refresh, silently re-acquired) is the
  standard, acceptable trade-off for that reduction.
- **Alternatives considered**: both tokens in `localStorage` (simpler, but defeats the purpose
  of hardening auth now that it's real); both tokens in httpOnly cookies (rejected — the
  access token needs to be readable by `apps/web` to attach as a Bearer header consistently
  with 001's existing API client shape; moving it to a cookie would require rewriting that
  client to rely on ambient cookie auth instead, a larger change than this feature needs).
- **Deployment note**: httpOnly cross-origin cookies require correct `SameSite`/CORS
  configuration between the web (5173) and API (3000) origins in dev, and a reverse proxy
  unifying the origin is recommended in production. Not a principle violation — an operational
  configuration detail to carry into `/speckit-tasks`.

## 4. Specification editor & diff view

- **Decision**: a plain `<textarea>` editor with a `react-markdown` preview pane side-by-side;
  the diff view renders the `{additions, deletions}` arrays 001's
  `GET /specifications/:id/versions/:a/diff/:b` already returns, as a simple two-color
  (added/removed) line list.
- **Rationale**: the backend already computes the diff (001, `specifications.service.ts`), so
  the frontend only needs to render two arrays — no diff-computation library needed on the
  client. A plain textarea plus preview keeps the editing surface simple, consistent with the
  constitution's simplicity principle, for what is fundamentally an internal spec-editing tool.
- **Alternatives considered**: `@uiw/react-md-editor` (a heavier, WYSIWYG-leaning editor);
  building a dedicated diff-editor component (rejected — the backend's array-based diff is
  already the harder half of that problem solved).

## 5. Protected routes

- **Decision**: a `<ProtectedRoute>` wrapper component reading `AuthContext`, applied per-route
  in the existing plain `<Routes>` tree in `apps/web/src/App.tsx`.
- **Rationale**: 001's router is a simple `<Routes>`/`<Route>` tree (no data router). A wrapper
  component is the natural, low-friction fit; restructuring into a data router with loaders
  for this feature's sake would be a larger, unrelated change.
- **Alternatives considered**: React Router 6.4+ data routers with `loader`-based auth checks
  (rejected — would force a router-architecture change unrelated to this feature's actual
  need).

## 6. Pagination convention

- **Decision**: every new/extended list endpoint returns the same envelope 001's `GET /demands`
  already established: `{ items, total, page, page_size }`, accepting `page`/`page_size` query
  params.
- **Rationale**: consistency — the frontend gets one paginated-list hook shape to reuse across
  every screen (`useDemandPolling`'s query pattern already demonstrates the approach); no
  reason to invent a second envelope shape.

## 7. Dashboard aggregation

- **Decision**: a dedicated `GET /dashboard/summary` endpoint doing the stage-count aggregation
  server-side (one `GROUP BY status` query) plus the N most recently updated demands, rather
  than having the frontend page through the full demand table to compute counts.
- **Rationale**: correctness at scale — counts must reflect the *whole* table, not just
  whatever page happened to be fetched; a single aggregation query is cheap and avoids that
  trap entirely.
- **Alternatives considered**: computing counts client-side from a large `GET /demands` page
  (rejected — either inaccurate past one page, or requires fetching an unbounded page size,
  which directly conflicts with SC-007's pagination requirement).

## Outcome

No `NEEDS CLARIFICATION` markers remain. The 3 items spec.md's Assumptions deliberately left
open (specific IdP, RBAC permission granularity, exact secret-detection pattern) are
deployment/config-level choices, not architecture-blocking — they're carried forward as
follow-ups for `/speckit-tasks` and deployment configuration, not resolved here.
