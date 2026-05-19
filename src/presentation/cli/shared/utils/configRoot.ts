import { homedir } from "node:os";
import { resolve } from "node:path";

export const CONFIG_ENV_VAR = "AGENT_CTRL_HOME";
export const CONFIG_SUBDIR = ".agent-ctrl";

export function resolveConfigRoot(targetPath?: string): string {
  if (targetPath) {
    return resolve(targetPath);
  }
  return resolve(process.env[CONFIG_ENV_VAR] ?? homedir(), CONFIG_SUBDIR);
}

export function resolveConfigParent(): string {
  return resolve(process.env[CONFIG_ENV_VAR] ?? homedir());
}
