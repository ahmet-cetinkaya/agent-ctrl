import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface McpPaths {
  configRoot: string;
  mcpDir: string;
  envPath: string;
}

export class McpPathResolver {
  resolve(projectPath: string): McpPaths {
    const configuredRoot = process.env.AGENT_CTRL_CONFIG_DIR;
    const defaultConfigRoot = resolve(projectPath, ".agent-ctrl");
    const configuredConfigRoot = configuredRoot
      ? isAbsolute(configuredRoot)
        ? configuredRoot
        : resolve(projectPath, configuredRoot)
      : defaultConfigRoot;

    // If no explicit config dir is provided and we're already inside config root,
    // avoid resolving to "<project>/.agent-ctrl/.agent-ctrl".
    const configRoot =
      !configuredRoot && !existsSync(configuredConfigRoot) && existsSync(resolve(projectPath, "mcps"))
        ? projectPath
        : configuredConfigRoot;

    const mcpDir = resolve(configRoot, "mcps");
    const envPath = resolve(mcpDir, ".env");

    return {
      configRoot,
      mcpDir,
      envPath,
    };
  }
}
