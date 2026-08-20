import { IsArray, IsOptional, IsUUID } from "class-validator";

/** feature 006 (US3, contracts/qa-functional-testing.md): omitido/vazio = todos os TestCase automatable=true da demanda. */
export class RunFunctionalTestsDto {
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  testCaseIds?: string[];
}
