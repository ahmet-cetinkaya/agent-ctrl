import { directoryExists } from "@/infrastructure/shared/utils/fsUtils";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import {
  getSupportedApplyPlatformsDisplay,
  parseSupportedApplyPlatform,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";
import {
  ApplySourceLoader,
  type ApplySourceSnapshot,
} from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { createRule } from "@/core/domain/shared/entities/Rule";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { resolve } from "node:path";
import { exportModelAliasRoutes } from "@/core/filestore/env-loader.js";

export interface ApplyProfileCommandOptions {
  projectPath: string;
  /** One or more profile names; several profiles are merged and applied together. */
  profileNames: readonly string[];
  platform: string;
  dryRun?: boolean;
  override?: boolean;
  targetScope?: ApplyPlatformScope;
  userConfigRootPath?: string;
  configRoot?: string;
}

export interface ApplyProfileCommandResult {
  platform: string;
  status: ApplyPlatformStatus;
  configPath: string;
  scope: "project" | "user";
  surface: string;
  message: string;
  artifactCounts?: {
    rules?: number;
    commands?: number;
    skills?: number;
    agents?: number;
    mcpServers?: number;
  };
  durationMs: number;
  fileChanges: string[];
  warnings: string[];
  isEmpty: boolean;
}

export class ApplyProfileCommand {
  private readonly adapterRegistry: PlatformAdapterRegistry;
  private readonly sourceLoader: ApplySourceLoader;

  constructor(adapterRegistry?: PlatformAdapterRegistry, sourceLoader?: ApplySourceLoader) {
    this.adapterRegistry = adapterRegistry ?? new PlatformAdapterRegistry();
    this.sourceLoader = sourceLoader ?? new ApplySourceLoader();
  }

  async execute(options: ApplyProfileCommandOptions): Promise<Result<ApplyProfileCommandResult, Error>> {
    const {
      projectPath,
      profileNames,
      platform,
      dryRun,
      override,
      targetScope,
      userConfigRootPath,
      configRoot: providedConfigRoot,
    } = options;

    const selectedPlatform = parseSupportedApplyPlatform(platform);
    if (!selectedPlatform) {
      return err(
        new UserError(
          `Platform '${platform}' is not supported. Supported platforms: ${getSupportedApplyPlatformsDisplay()}. Check for typos or run 'agent-ctrl apply --help' for more information.`,
          ERROR_IDS.CLI_INVALID_ARGUMENT
        )
      );
    }

    if (profileNames.length === 0) {
      return err(new UserError("At least one profile name is required.", ERROR_IDS.CLI_INVALID_ARGUMENT));
    }
    const profileLabel = profileNames.join(", ");

    try {
      const configRoot = providedConfigRoot ?? resolve(projectPath, ".agent-ctrl");

      if (!(await directoryExists(configRoot))) {
        return err(
          new UserError(
            `No .agent-ctrl directory found at ${configRoot}. Initialize the project first.`,
            ERROR_IDS.NO_SUCH_FILE_OR_DIRECTORY
          )
        );
      }

      for (const profileName of profileNames) {
        if (!(await directoryExists(resolve(configRoot, "profiles", profileName)))) {
          return err(
            new ProfileError(
              `Profile '${profileName}' not found in .agent-ctrl/profiles/`,
              profileName,
              ERROR_IDS.PROFILE_NOT_FOUND
            )
          );
        }
      }

      const adapter = this.adapterRegistry.resolve(selectedPlatform);
      const startedAt = Date.now();

      const profileSnapshot = await this.loadProfiles(configRoot, profileNames);

      await exportModelAliasRoutes(projectPath);
      const applyResult = await adapter.applyApplyIntegration({
        projectPath,
        dryRun,
        override,
        targetScope,
        userConfigRootPath,
        mergedSnapshot: {
          rules: profileSnapshot.rules,
          skills: profileSnapshot.skills,
          agents: profileSnapshot.agents,
          commands: profileSnapshot.commands,
          mcpServers: profileSnapshot.mcpServers,
          warnings: profileSnapshot.warnings,
        },
      });

      const durationMs = Date.now() - startedAt;
      const warnings: string[] = [...(applyResult.warnings ?? [])];
      if (dryRun) {
        warnings.push("Dry run mode: no file system changes are written.");
      }

      const isEmpty =
        profileSnapshot.rules.length === 0 &&
        profileSnapshot.skills.length === 0 &&
        profileSnapshot.agents.length === 0 &&
        profileSnapshot.commands.length === 0 &&
        profileSnapshot.mcpServers.length === 0;

      return ok({
        platform: applyResult.platform,
        status: applyResult.status,
        configPath: applyResult.configPath,
        scope: applyResult.scope,
        surface: applyResult.surface,
        message: applyResult.message,
        artifactCounts: applyResult.artifactCounts ?? {
          rules: profileSnapshot.rules.length,
          skills: profileSnapshot.skills.length,
          agents: profileSnapshot.agents.length,
          commands: profileSnapshot.commands.length,
          mcpServers: profileSnapshot.mcpServers.length,
        },
        durationMs,
        fileChanges: [...(applyResult.fileChanges ?? [])],
        warnings,
        isEmpty,
      });
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = `Failed to apply profile '${profileLabel}' to '${selectedPlatform}' platform`;

      if (nodeErr.code === "EACCES") {
        message += ": Permission denied writing platform configuration. Check file/directory permissions.";
      } else if (nodeErr.code === "ENOSPC") {
        message += ": No space left on device. Free up disk space and try again.";
      } else if (nodeErr.code === "EROFS") {
        message += ": Filesystem is read-only. Cannot write configuration.";
      } else if (error instanceof Error) {
        message += `: ${error.message}`;
      } else {
        message += `: ${String(error)}`;
      }

      return err(new SystemError(message, ERROR_IDS.PLATFORM_CONFIG_WRITE_FAILED));
    }
  }
  /**
   * Loads every named profile into one snapshot so a single apply writes all of them;
   * applying them one by one let each profile replace the previous one's rules.
   */
  private async loadProfiles(configRoot: string, profileNames: readonly string[]): Promise<ApplySourceSnapshot> {
    const snapshots = await Promise.all(
      profileNames.map(async (name) => ({
        name,
        snapshot: await this.sourceLoader.loadProfile(resolve(configRoot, "profiles", name)),
      }))
    );
    if (snapshots.length === 1) {
      return snapshots[0].snapshot;
    }

    const warnings: string[] = [];
    const combine = <T>(
      kind: string,
      pick: (snapshot: ApplySourceSnapshot) => readonly T[],
      key: (item: T) => string
    ) => {
      const byKey = new Map<string, T>();
      for (const { name, snapshot } of snapshots) {
        for (const item of pick(snapshot)) {
          if (byKey.has(key(item))) {
            warnings.push(`Profile '${name}' replaces ${kind} '${key(item)}' from an earlier profile.`);
          }
          byKey.set(key(item), item);
        }
      }
      return [...byKey.values()];
    };

    return {
      // Profiles share rule file names (coding-style.md, testing.md, ...), so each rule is
      // namespaced by its profile to keep every profile's rules.
      rules: snapshots.flatMap(({ name, snapshot }) =>
        snapshot.rules.map((rule) => createRule(`${name}/${rule.id}`, `${name}/${rule.filename}`, rule.path))
      ),
      skills: combine(
        "skill",
        (snapshot) => snapshot.skills,
        (skill) => skill.id
      ),
      agents: combine(
        "agent",
        (snapshot) => snapshot.agents,
        (agent) => agent.id
      ),
      commands: combine(
        "command",
        (snapshot) => snapshot.commands,
        (command) => command.id
      ),
      mcpServers: combine(
        "MCP server",
        (snapshot) => snapshot.mcpServers,
        (server) => server.name
      ),
      warnings: [...snapshots.flatMap(({ snapshot }) => snapshot.warnings), ...warnings],
    };
  }
}
