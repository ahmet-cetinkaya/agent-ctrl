import { Command } from "commander";
import { ListSkillsQuery } from "@/core/application/features/skill/queries/ListSkillsQuery";
import { resolve } from "node:path";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

/**
 * Creates the 'skill ls' CLI subcommand for listing all skills in the project.
 *
 * The skill ls subcommand lists all skill artifacts found in the skills/ directory.
 * Supports both project-scoped and global user configuration via the AGENT_CTRL_HOME
 * environment variable or --path option.
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # List skills in default location
 * agent-ctrl skill ls
 *
 * # List skills in JSON format
 * agent-ctrl skill ls --json
 *
 * # List skills from custom config root
 * agent-ctrl skill ls /custom/path
 * ```
 */
export function createSkillListCommand(): Command {
  return new Command("ls")
    .description("List all skills in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      // Validate user-provided path
      if (targetPath) {
        const pathError = validateUserPath(targetPath, "--path");
        if (pathError) {
          LogService.error(pathError);
          process.exit(1);
        }
      }

      const configRootPath = resolveConfigRoot(targetPath);
      const skillsPath = resolve(configRootPath, "skills");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(skillsPath, "skills/");
      if (!accessResult.success) {
        LogService.error(accessResult.error ?? "Directory access failed");
        process.exit(1);
      }

      const listSkillsQuery = new ListSkillsQuery();
      const result = await listSkillsQuery.execute({ skillsPath });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }

      const { artifacts, warnings, catalogState } = result.data;
      const { managedById, catalogById } = catalogState;

      if (options.json) {
        LogService.unstyled(
          JSON.stringify(
            {
              artifacts,
              warnings,
              managed: artifacts.map((artifact) => ({
                artifact,
                managed: managedById.get(artifact.id),
                catalog: catalogById.get(artifact.id),
              })),
            },
            null,
            2
          )
        );
        return;
      }

      LogService.intro("Listing skills");

      if (artifacts.length === 0) {
        LogService.info("No skills found in skills/ directory");
      } else {
        const list = artifacts
          .map((artifact) => {
            const managed = managedById.get(artifact.id);
            const catalog = catalogById.get(artifact.id);
            const details = [
              managed?.state,
              catalog?.compatibilityState,
              catalog?.sourceVersion ? `v${catalog.sourceVersion}` : undefined,
            ]
              .filter(Boolean)
              .join(" | ");
            return `  ${artifact.id}${details ? ` (${details})` : ""}`;
          })
          .join("\n");
        LogService.note(list, `Skills (${artifacts.length}):`);
      }

      if (warnings.length > 0 && !options.json) {
        LogService.note(warnings.join("\n"), "Warnings:");
      }
    });
}
