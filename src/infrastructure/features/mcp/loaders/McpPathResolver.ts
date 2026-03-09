import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface McpPaths {
  configRoot: string;
  mcpDir: string;
  envPath: string;
}

export class McpPathResolver {
  constructor() {}

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

    // Check for .env in mcps/ first, then fall back to config root
    const mcpsEnvPath = resolve(mcpDir, ".env");
    const configEnvPath = resolve(configRoot, ".env");
    const envPath = existsSync(mcpsEnvPath) ? mcpsEnvPath : configEnvPath;

    return {
      configRoot,
      mcpDir,
      envPath,
    };
  }
}
