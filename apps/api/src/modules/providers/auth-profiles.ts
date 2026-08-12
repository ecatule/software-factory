import type { SpecKitAuthProfile } from "@software-factory/infrastructure";

/**
 * Auth profiles are resolved ONLY from environment variables, never the
 * database (secret-pattern.guard.ts already rejects anything secret-looking
 * in a ProviderConfiguration row) — `authProfileKey` in Settings is just a
 * non-secret label (e.g. "default", "personal", "work") that picks one of
 * these env-backed profiles. Convention: `SDD_AUTH_PROFILE_<KEY>_OAUTH_TOKEN`
 * / `_API_KEY` / `_CONFIG_DIR`, `<KEY>` being the label upper-cased with
 * non-alphanumerics turned into `_`. Adding a new account later is purely an
 * env change — generate a token with `claude setup-token` under that
 * account, add the 3 variables under a new `<KEY>`, pick that label in
 * Settings. No code or DB change required.
 *
 * Own file (not inside providers.module.ts) so `ProvidersController` can
 * import it directly for `GET /providers/auth-profiles` (follow-up: lists
 * only the profile NAMES, never the credential values) without a circular
 * import between the module and its own controller.
 */
export function resolveAuthProfilesFromEnv(): Record<string, SpecKitAuthProfile> {
  const profiles: Record<string, SpecKitAuthProfile> = {};
  for (const [envKey, value] of Object.entries(process.env)) {
    if (!value) continue;
    const match = envKey.match(/^SDD_AUTH_PROFILE_(.+)_(OAUTH_TOKEN|API_KEY|CONFIG_DIR)$/);
    if (!match) continue;
    const [, rawKey, kind] = match;
    const key = rawKey.toLowerCase();
    profiles[key] ??= {};
    if (kind === "OAUTH_TOKEN") profiles[key].oauthToken = value;
    if (kind === "API_KEY") profiles[key].apiKey = value;
    if (kind === "CONFIG_DIR") profiles[key].configDir = value;
  }
  return profiles;
}
