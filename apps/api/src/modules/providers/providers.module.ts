import { Module } from "@nestjs/common";
import {
  CODE_REPOSITORY_PROVIDER,
  DEMAND_PROVIDER,
  LLM_PROVIDER,
  SDD_PROVIDER,
  type LLMProvider,
} from "@software-factory/domain";
import {
  ChatGPTProvider,
  ClaudeProvider,
  GitHubRepositoryProvider,
  MondayDemandProvider,
  SpecKitProvider,
  type SpecKitAuthProfile,
} from "@software-factory/infrastructure";
import { ProvidersController } from "./providers.controller";
import { ProviderConfigurationResolver } from "./provider-configuration.resolver";

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
 */
function resolveAuthProfilesFromEnv(): Record<string, SpecKitAuthProfile> {
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

/**
 * DI wiring for the Provider interfaces declared in packages/domain. Only
 * this module (and other modules under `modules/providers` as they're
 * added) may import a concrete adapter from packages/infrastructure —
 * everything else depends on the interface + token only (constitution:
 * Provider Abstraction). Selecting a *different* concrete provider per
 * project/pipeline-stage (via ProviderConfiguration, spec FR-008) is done
 * via the ProviderConfiguration rows managed through `ProvidersController`
 * (spec 002 US15/Settings) — this still wires the platform-default instance
 * from environment configuration (`LLM_PROVIDER=chatgpt|claude`) as the
 * fallback when no configuration row applies.
 */
@Module({
  controllers: [ProvidersController],
  providers: [
    {
      provide: DEMAND_PROVIDER,
      useFactory: () =>
        new MondayDemandProvider({
          apiUrl: process.env.MONDAY_API_URL ?? "https://api.monday.com/v2",
          apiToken: process.env.MONDAY_API_TOKEN ?? "",
        }),
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (): LLMProvider =>
        process.env.LLM_PROVIDER === "claude"
          ? new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" })
          : new ChatGPTProvider({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
    },
    {
      provide: SDD_PROVIDER,
      useFactory: () =>
        new SpecKitProvider({
          specifyCommand: process.env.SDD_SPECIFY_CLI_COMMAND || undefined,
          claudeCommand: process.env.SDD_CLI_COMMAND || undefined,
          defaultModel: process.env.SDD_DEFAULT_MODEL || undefined,
          timeoutMs: process.env.SDD_CLI_TIMEOUT_MS
            ? Number(process.env.SDD_CLI_TIMEOUT_MS)
            : undefined,
          authProfiles: resolveAuthProfilesFromEnv(),
        }),
    },
    {
      provide: CODE_REPOSITORY_PROVIDER,
      useFactory: () =>
        new GitHubRepositoryProvider({
          apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
          token: process.env.GITHUB_TOKEN ?? "",
        }),
    },
    ProviderConfigurationResolver,
  ],
  exports: [
    DEMAND_PROVIDER,
    LLM_PROVIDER,
    SDD_PROVIDER,
    CODE_REPOSITORY_PROVIDER,
    ProviderConfigurationResolver,
  ],
})
export class ProvidersModule {}
