import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Writes a command and an agent that carry the canonical `model` field plus a
 * per-platform `models:` override map, for cross-platform model frontmatter tests.
 */
export async function writeModelFrontmatterFixtures(projectPath: string): Promise<void> {
  await mkdir(resolve(projectPath, ".agent-ctrl", "commands"), { recursive: true });
  await mkdir(resolve(projectPath, ".agent-ctrl", "agents"), { recursive: true });

  await writeFile(
    resolve(projectPath, ".agent-ctrl", "commands", "model-test.md"),
    [
      "---",
      "description: Model frontmatter smoke test",
      "model: anthropic/claude-sonnet-4-5",
      "models:",
      "  qwen: fast",
      "---",
      "",
      "Smoke test body.",
      "",
    ].join("\n"),
    "utf-8"
  );

  await writeFile(
    resolve(projectPath, ".agent-ctrl", "agents", "model-agent.md"),
    [
      "---",
      "description: Model frontmatter agent",
      "model: anthropic/claude-sonnet-4-5",
      "models:",
      "  qwen: fast",
      "---",
      "",
      "Agent body.",
      "",
    ].join("\n"),
    "utf-8"
  );
}
