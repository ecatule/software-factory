import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DemandsService } from "./demands.service";

const PLACEHOLDER = "[COLE AQUI A ESPECIFICAÇÃO DE NEGÓCIO]";

/**
 * feature 005 User Story 4 (contracts/prompt-generation.md, FR-014-FR-019):
 * consolidates demand context into the versioned `prompt-spec-kit.md`
 * template — pure string building, deliberately zero network/provider calls
 * (FR-018). Resolved relative to `__dirname` (not `process.cwd()`), same
 * reasoning as `WorkspacesService`'s `WORKSPACE_ROOT` — the process may be
 * launched from a different working directory than `apps/api/`.
 */
@Injectable()
export class PromptSpecService {
  private readonly templatePath =
    process.env.SPEC_PROMPT_TEMPLATE_PATH ??
    path.resolve(__dirname, "../../../prompts/prompt-spec-kit.md");

  constructor(
    private readonly prisma: PrismaService,
    private readonly demandsService: DemandsService,
  ) {}

  async generate(demandId: string, business: string, technical: string): Promise<{ prompt: string }> {
    const demand = await this.demandsService.get(demandId);
    const client = await this.prisma.db.client.findUnique({ where: { id: demand.clientId } });
    const { selected: systems } = await this.demandsService.getAvailableAndSelectedSystems(demandId);
    const { selected: artifacts } =
      await this.demandsService.getAvailableAndSelectedSystemArtifacts(demandId);

    const consolidated = this.buildConsolidatedContext(
      demand,
      client?.name ?? "(cliente não encontrado)",
      business,
      technical,
      systems,
      artifacts,
    );

    const template = await readFile(this.templatePath, "utf-8");
    if (!template.includes(PLACEHOLDER)) {
      throw new Error(`Prompt template at ${this.templatePath} is missing the expected placeholder`);
    }
    return { prompt: template.replace(PLACEHOLDER, consolidated) };
  }

  private buildConsolidatedContext(
    demand: { title: string; description: string },
    clientName: string,
    business: string,
    technical: string,
    systems: { id: string; name: string }[],
    artifacts: { id: string; systemId: string; name: string; type: string; technology: string | null }[],
  ): string {
    const sections = [
      `# CONTEXTO DA DEMANDA\n\n${demand.title}\n\n${demand.description}`,
      `# CLIENTE\n\n${clientName}`,
      `# INFORMAÇÕES DE NEGÓCIO\n\n${business || "(não informado)"}`,
      `# INSUMOS TÉCNICOS\n\n${technical || "(não informado)"}`,
      `# SISTEMAS ENVOLVIDOS\n\n${
        systems.length ? systems.map((s) => `- ${s.name}`).join("\n") : "(nenhum sistema selecionado)"
      }`,
      `# ARTEFATOS ENVOLVIDOS\n\n${
        artifacts.length
          ? systems
              .map((system) => {
                const systemArtifacts = artifacts.filter((a) => a.systemId === system.id);
                if (!systemArtifacts.length) return null;
                const lines = systemArtifacts
                  .map((a) => `  - ${a.name} (${a.type}${a.technology ? `, ${a.technology}` : ""})`)
                  .join("\n");
                return `Sistema: ${system.name}\n${lines}`;
              })
              .filter(Boolean)
              .join("\n\n")
          : "(nenhum artefato selecionado)"
      }`,
    ];
    return sections.join("\n\n---\n\n");
  }
}
