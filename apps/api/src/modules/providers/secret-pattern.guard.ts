import { HttpException, HttpStatus } from "@nestjs/common";

// follow-up: exported so production-reference.guard.ts can reuse the same
// patterns when scanning cloned Artefato repositories, instead of duplicating them.
export const SECRET_LOOKING_KEY = /key|secret|token|password|credential/i;
// Common API-key shapes: long base64/hex-ish runs, or vendor-prefixed tokens (sk-, ghp_, ...).
export const SECRET_LOOKING_VALUE = /^(sk-|ghp_|gho_|xox[baprs]-)|^[A-Za-z0-9+/_-]{32,}$/;

/**
 * spec 002 FR-031: best-effort guard, not a guarantee — rejects a
 * ProviderConfiguration `settings` payload that looks like it contains a
 * secret. Real secret management remains an environment/secret-store
 * responsibility (constitution: no credential in code or data).
 */
export function assertNoSecretLookingValues(settings: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(settings)) {
    const looksLikeSecretKey = SECRET_LOOKING_KEY.test(key);
    const looksLikeSecretValue = typeof value === "string" && SECRET_LOOKING_VALUE.test(value);
    if (looksLikeSecretKey || looksLikeSecretValue) {
      throw new HttpException(
        {
          message:
            `Refusing to save "${key}" — it looks like a secret. Secrets belong in ` +
            "environment/secret-store configuration, never in a ProviderConfiguration row.",
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
