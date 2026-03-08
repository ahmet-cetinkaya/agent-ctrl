import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class ClaudeApplyAdapter implements IAppyPlatformAdapter {
  readonly platformName = "claude" as const;

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = request?.targetScope ?? "user";
    const claudeRoot =
      scope === "project"
        ? resolve(projectPath, ".claude")
        : resolve(process.env.AGENT_CTRL_CLAUDE_HOME || homedir(), ".claude");

    return {
      configPath: resolve(claudeRoot, "commands"),
      scope,
      surface: "commands",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const sourceRoot =
      target.scope === "project"
        ? resolve(request.projectPath, ".agent-ctrl", "commands")
        : resolve(request.userConfigRootPath ?? resolve(homedir(), ".agent-ctrl"), "commands");

    const sourceExists = await access(sourceRoot)
      .then(() => true)
      .catch(() => false);

    if (!sourceExists) {
      return {
        platform: this.platformName,
        configPath: target.configPath,
        scope: target.scope,
        surface: target.surface,
        status: "unchanged",
        message: `No managed Claude commands found at ${sourceRoot}.`,
      };
    }

    const markdownFiles = await this.collectMarkdownFiles(sourceRoot);
    if (markdownFiles.length === 0) {
      return {
        platform: this.platformName,
        configPath: target.configPath,
        scope: target.scope,
        surface: target.surface,
        status: "unchanged",
        message: `No markdown command files found at ${sourceRoot}.`,
      };
    }

    let changed = false;

    for (const filePath of markdownFiles) {
      const rel = relative(sourceRoot, filePath);
      const dest = resolve(target.configPath, rel);
      const sourceContent = await readFile(filePath, "utf-8");
      const existingContent = await readFile(dest, "utf-8").catch(() => null);

      if (existingContent !== sourceContent) {
        changed = true;
        if (!request.dryRun) {
          await mkdir(dirname(dest), { recursive: true });
          await writeFile(dest, sourceContent, "utf-8");
        }
      }
    }

    if (!request.dryRun && changed) {
      // Ensure the target root exists even if only nested files were copied.
      await mkdir(target.configPath, { recursive: true });
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: changed ? "success" : "unchanged",
      message: changed
        ? "Copied managed Claude command markdown files."
        : "Claude command markdown files are already in sync.",
    };
  }

  private async collectMarkdownFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await this.collectMarkdownFiles(fullPath)));
        continue;
      }
      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        out.push(fullPath);
      }
    }

    return out;
  }
}
