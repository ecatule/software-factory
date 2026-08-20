import { Module } from "@nestjs/common";
import {
  CHANGE_MANAGEMENT_PROVIDER,
  CODE_REPOSITORY_PROVIDER,
  DEMAND_PROVIDER,
  GRAPH_STORE_PROVIDER,
  LLM_PROVIDER,
  SDD_PROVIDER,
  TEST_EXECUTOR_PROVIDER,
  type LLMProvider,
  type TestExecutorProvider,
} from "@software-factory/domain";
import {
  ApiTestExecutorProvider,
  BrowserTestExecutorProvider,
  ChatGPTProvider,
  ClaudeProvider,
  CompositeTestExecutorProvider,
  GitHubRepositoryProvider,
  MondayChangeManagementProvider,
  MondayDemandProvider,
  Neo4jGraphStoreProvider,
  SpecKitProvider,
  UnitTestExecutorProvider,
} from "@software-factory/infrastructure";
import { ProvidersController } from "./providers.controller";
import { ProviderConfigurationResolver } from "./provider-configuration.resolver";
import { resolveAuthProfilesFromEnv } from "./auth-profiles";

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
      // GMUD: same Monday account/token as DEMAND_PROVIDER above, reused —
      // not a separate credential, just a different capability (writes to
      // a fixed change-management board instead of reading a demand board).
      provide: CHANGE_MANAGEMENT_PROVIDER,
      useFactory: () =>
        new MondayChangeManagementProvider({
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
    {
      provide: GRAPH_STORE_PROVIDER,
      useFactory: () =>
        new Neo4jGraphStoreProvider({
          uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
          username: process.env.NEO4J_USERNAME ?? "neo4j",
          password: process.env.NEO4J_PASSWORD ?? "",
          database: process.env.NEO4J_DATABASE || undefined,
        }),
    },
    {
      // feature 006 (spec User Story 3, tasks.md T027): um único token que
      // delega por TestCase.type — registrado aqui (e não no Foundational)
      // porque só a partir de US3 uma implementação concreta existe.
      provide: TEST_EXECUTOR_PROVIDER,
      useFactory: (): TestExecutorProvider =>
        new CompositeTestExecutorProvider([
          new ApiTestExecutorProvider(),
          new BrowserTestExecutorProvider(),
          new UnitTestExecutorProvider(),
        ]),
    },
    ProviderConfigurationResolver,
  ],
  exports: [
    DEMAND_PROVIDER,
    CHANGE_MANAGEMENT_PROVIDER,
    LLM_PROVIDER,
    SDD_PROVIDER,
    CODE_REPOSITORY_PROVIDER,
    GRAPH_STORE_PROVIDER,
    TEST_EXECUTOR_PROVIDER,
    ProviderConfigurationResolver,
  ],
})
export class ProvidersModule {}
