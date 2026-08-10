import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../identity/auth/jwt-auth.guard";
import { TechnologiesService } from "./technologies.service";
import { CreateTechnologyDto, UpdateTechnologyDto } from "./dto/technology.dto";

@ApiTags("technologies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("technologies")
export class TechnologiesController {
  constructor(private readonly technologiesService: TechnologiesService) {}

  @Get()
  list(@Query("page") page?: string, @Query("page_size") pageSize?: string) {
    return this.technologiesService.list(
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post()
  create(@Body() dto: CreateTechnologyDto) {
    return this.technologiesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTechnologyDto) {
    return this.technologiesService.update(id, dto);
  }
}
