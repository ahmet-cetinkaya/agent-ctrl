import { Command } from "commander";
import { resolve } from "node:path";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { getSupportedApplyPlatformsDisplay } from "@/core/domain/shared/types/SupportedApplyPlatform";

export function createApplyCommand(): Command {
  const supportedPlatformsDisplay = getSupportedApplyPlatformsDisplay();

  return new Command("apply")
    .description("Apply managed appy integration to one selected platform")
    .argument("<platform>", `Target platform. Supported platforms: ${supportedPlatformsDisplay}`)
    .option("-d, --dry-run", "Show selected-platform changes without writing files", false)
    .option("-o, --override", "Replace conflicting appy configuration with managed state", false)
    .action(async (platform: string, options: { dryRun?: boolean; override?: boolean }) => {
      const applyCommand = new ApplyCommand();

      try {
        const result = await applyCommand.execute({
          projectPath: resolve(process.cwd()),
          platform,
          dryRun: options.dryRun,
          override: options.override,
        });

        if (!result.success) {
          if (result.error instanceof UserError || result.error instanceof SystemError) {
            console.error(`✗ ${result.error.message}`);
            process.exit(result.error.exitCode);
          }
          console.error(`✗ Unexpected error: ${result.error}`);
          process.exit(2);
        }

        const { platform: selectedPlatform, status, configPath, scope, surface, warnings, durationMs } = result.data;

        if (options.dryRun) {
          console.log(`[Dry run] Selected platform: ${selectedPlatform}`);
          console.log(`[Dry run] Result: ${status}`);
          console.log(`[Dry run] Scope: ${scope}`);
          console.log(`[Dry run] Surface: ${surface}`);
          console.log(`[Dry run] Target path: ${configPath}`);
          console.log(`[Dry run] Estimated duration: ${durationMs}ms`);
        } else {
          if (status === "unchanged") {
            console.log(`✓ ${selectedPlatform}: unchanged`);
          } else {
            console.log(`✓ ${selectedPlatform}: success`);
          }
          console.log(`Scope: ${scope}`);
          console.log(`Surface: ${surface}`);
          console.log(`Configuration path: ${configPath}`);
          console.log(`Duration: ${durationMs}ms`);
        }

        if (warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of warnings) {
            console.log(`  - ${warning}`);
          }
        }
      } catch (error) {
        console.error(`✗ Unexpected error: ${error}`);
        process.exit(2);
      }
    });
}
