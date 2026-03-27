import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("KiloAdapter", () => {
  let projectPath: string;
  let adapter: KiloAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "kilo-adapter-"));
    await writeApplyFixtures(projectPath);
    adapter = new KiloAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("creates rules, workflows, and skills", async () => {
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, ".kilocode"));
    expect(result.surface).toBe("rules-workflows-skills-agents-mcp");
    await expect(access(resolve(projectPath, ".kilocode", "rules", "coding-style.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "workflows", "dev-fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".kilocode", "kilo.json"))).resolves.toBeNull();
    expect(result.warnings).not.toContain("Kilo does not have a documented apply target for agents.");
    expect(result.warnings).not.toContain("Kilo does not have a documented apply target for MCP servers.");
  });

  it("reapplies idempotently", async () => {
    await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyAppyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });
});
