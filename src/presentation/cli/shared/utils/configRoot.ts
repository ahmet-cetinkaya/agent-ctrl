import { homedir } from "node:os";
import { resolve } from "node:path";

export function resolveConfigRoot(targetPath?: string): string {
  if (targetPath) {
    return resolve(targetPath);
  }
  return resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
}
