import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * The branch used to check out every repository this feature analyzes —
 * global, not per-artifact/repository (an analyst sets it once on the
 * Artefatos screen; every "Mapear dependências" trigger reuses it). A
 * single-row table since there is exactly one value, ever.
 */
@Injectable()
export class DependencyAnalyzerSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.db.dependencyAnalyzerSettings.findFirst();
    return { defaultBranch: settings?.defaultBranch ?? null };
  }

  async update(defaultBranch: string, updatedBy?: string) {
    const existing = await this.prisma.db.dependencyAnalyzerSettings.findFirst();
    if (existing) {
      await this.prisma.db.dependencyAnalyzerSettings.update({
        where: { id: existing.id },
        data: { defaultBranch, updatedBy },
      });
    } else {
      await this.prisma.db.dependencyAnalyzerSettings.create({ data: { defaultBranch, updatedBy } });
    }
    return { defaultBranch };
  }
}
