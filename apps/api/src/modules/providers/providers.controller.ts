import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";
import { paginate } from "../../common/pagination/paginate";
import { CreateProviderConfigurationDto } from "./dto/provider-configuration.dto";
import { assertNoSecretLookingValues } from "./secret-pattern.guard";
import { resolveAuthProfilesFromEnv } from "./auth-profiles";

/**
 * spec 002 FR-029/FR-030/FR-031: Settings screen backend — 001 registered
 * Provider/ProviderConfiguration internally (DI factories only) but never
 * exposed them over HTTP.
 */
@ApiTags("providers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles("admin")
@Controller("providers")
export class ProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.db.provider.findMany({ orderBy: { key: "asc" } });
  }

  /**
   * follow-up: lists only the profile NAMES configured via
   * `SDD_AUTH_PROFILE_<KEY>_*` env vars on this server — never the
   * credential values themselves (`resolveAuthProfilesFromEnv` returns those
   * too, but only the keys are returned here). Lets the Settings screen
   * offer a dropdown of real, currently-available profiles instead of a
   * free-text field the admin has to already know by heart.
   */
  @Get("auth-profiles")
  listAuthProfiles() {
    return Object.keys(resolveAuthProfilesFromEnv()).sort();
  }

  @Get(":id/configurations")
  configurations(
    @Param("id") providerId: string,
    @Query("project_id") projectId?: string,
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
  ) {
    const where = { providerId, projectId };
    return paginate(
      (skip, take) =>
        this.prisma.db.providerConfiguration.findMany({ where, skip, take }),
      () => this.prisma.db.providerConfiguration.count({ where }),
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post(":id/configurations")
  createConfiguration(
    @Param("id") providerId: string,
    @Body() dto: CreateProviderConfigurationDto,
  ) {
    assertNoSecretLookingValues(dto.settings);
    return this.prisma.db.providerConfiguration.create({
      data: {
        providerId,
        projectId: dto.projectId,
        pipelineStage: dto.pipelineStage,
        settings: dto.settings,
      },
    });
  }
}
