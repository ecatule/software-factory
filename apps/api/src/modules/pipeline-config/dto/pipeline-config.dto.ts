import { IsIn } from "class-validator";

export class UpdatePipelineStageConfigDto {
  @IsIn(["AUTO", "MANUAL"])
  mode!: "AUTO" | "MANUAL";
}
