import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function writeApplyFixtures(projectPath: string): Promise<void> {
  await mkdir(resolve(projectPath, ".agent-ctrl", "rules"), { recursive: true });
  await mkdir(resolve(projectPath, ".agent-ctrl", "skills", "git-workflow"), { recursive: true });
  await mkdir(resolve(projectPath, ".agent-ctrl", "agents"), { recursive: true });
  await mkdir(resolve(projectPath, ".agent-ctrl", "commands", "dev"), { recursive: true });
  await mkdir(resolve(projectPath, ".agent-ctrl", "mcps"), { recursive: true });

  await writeFile(resolve(projectPath, ".agent-ctrl", "rules", "coding-style.md"), "# Coding Style\n\nUse Bun.\n", "utf-8");
  await writeFile(
    resolve(projectPath, ".agent-ctrl", "skills", "git-workflow", "SKILL.md"),
    "# Git Workflow\n\nUse scoped commits.\n",
    "utf-8"
  );
  await writeFile(resolve(projectPath, ".agent-ctrl", "agents", "architect.md"), "# Architect Agent\n\nBe explicit.\n", "utf-8");
  await writeFile(resolve(projectPath, ".agent-ctrl", "commands", "dev", "fix-lint.md"), "# Fix Lint\n\nRun lint.\n", "utf-8");
  await writeFile(
    resolve(projectPath, ".agent-ctrl", "mcps", "context7.json"),
    JSON.stringify({
      mcpServers: {
        context7: {
          command: "npx",
          args: ["-y", "@upstash/context7-mcp"],
        },
      },
    }),
    "utf-8"
  );
}
