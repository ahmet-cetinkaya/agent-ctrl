import { homedir } from "node:os";
import { resolve } from "node:path";

export interface CatalogPaths {
  configRoot: string;
  skillsDir: string;
  mcpsDir: string;
  catalogDir: string;
  stateFile: string;
  logFile: string;
}

export class CatalogPathResolver {
  constructor() {}

  resolveFromHomeBase(homeBase?: string): CatalogPaths {
    const configRoot = resolve(homeBase ?? process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
    return this.resolveFromConfigRoot(configRoot);
  }

  resolveFromConfigRoot(configRoot: string): CatalogPaths {
    return {
      configRoot,
      skillsDir: resolve(configRoot, "skills"),
      mcpsDir: resolve(configRoot, "mcps"),
      catalogDir: resolve(configRoot, ".catalog"),
      stateFile: resolve(configRoot, ".catalog", "state.json"),
      logFile: resolve(configRoot, ".catalog", "operations.jsonl"),
    };
  }
}
