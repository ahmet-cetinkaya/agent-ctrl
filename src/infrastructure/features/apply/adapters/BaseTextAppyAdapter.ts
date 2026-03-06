import { dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { AppyMergePolicy } from "@/infrastructure/features/apply/adapters/AppyMergePolicy";

export abstract class BaseTextAppyAdapter implements IAppyPlatformAdapter {
  abstract readonly platformName: SupportedApplyPlatform;

  protected constructor() {}

  abstract resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget>;

  protected abstract buildDesiredContent(target: AppyConfigTarget): string;

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const desiredContent = this.buildDesiredContent(target);
    const existingContent = await readFile(target.configPath, "utf-8").catch(() => null);
    const merged = AppyMergePolicy.mergeText(existingContent, desiredContent, Boolean(request.override));

    if (!request.dryRun && merged.status === "success") {
      await mkdir(dirname(target.configPath), { recursive: true });
      await writeFile(target.configPath, `${merged.content.trimEnd()}\n`, "utf-8");
    }

    return {
      platform: this.platformName,
      status: merged.status,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      message:
        merged.status === "unchanged"
          ? "Selected platform already contains the required appy integration."
          : "Applied appy integration for selected platform.",
    };
  }
}
