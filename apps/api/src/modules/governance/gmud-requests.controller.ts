import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { RequirePermission } from "../identity/guards/permissions.decorator";
import { GmudRequestsService } from "./gmud-requests.service";
import { CreateGmudRequestDto } from "./dto/gmud.dto";

/** GMUD (Gestão de Mudanças) — abre solicitação de deploy no Monday a partir de uma Demanda. */
@ApiTags("governance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("governance/gmud")
export class GmudRequestsController {
  constructor(private readonly gmudRequests: GmudRequestsService) {}

  @Post()
  @RequirePermission("GMUD_WRITE")
  create(@Body() dto: CreateGmudRequestDto) {
    return this.gmudRequests.create(dto.demandId, dto.environment);
  }

  @Get()
  @RequirePermission("GMUD_READ")
  list(@Query("demandId") demandId: string) {
    return this.gmudRequests.listForDemand(demandId);
  }

  /** feeds the trigger screen's "Apis/Telas" preview — every artifact the demand ever selected, not just the current round. */
  @Get("artifacts")
  @RequirePermission("GMUD_READ")
  listArtifacts(@Query("demandId") demandId: string) {
    return this.gmudRequests.listAllArtifactsEverSelected(demandId);
  }
}
