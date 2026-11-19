import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("CursorAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: CursorAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "cursor-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "cursor-user-"));
    await writeApplyFixtures(projectPath);
    adapter = new CursorAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("writes project-scope rules as .mdc files when explicitly requested", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, ".cursor", "rules"));
    expect(result.surface).toBe("cursor-rules-mdc");
    // Rules are written as .mdc files with YAML frontmatter
    await expect(access(resolve(projectPath, ".cursor", "rules"))).resolves.toBeNull();
    // Commands and agents are written as skills with warnings
    expect(result.warnings!.some((w) => w.includes("Commands are being written as skills"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(true);
    // MCP servers are not supported
    expect(result.warnings!.some((w) => w.includes("MCP servers will not be applied"))).toBe(true);
    // Skills are written to .cursor/skills/
    await expect(access(resolve(projectPath, ".cursor", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });

  it("writes user-scope rules as a fallback with warning", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "rules"));
    // Warning about global rules being via Settings UI
    expect(result.warnings!.some((w) => w.includes("Settings UI"))).toBe(true);
  });

  it("cleans existing managed rules when override is enabled", async () => {
    // Create initial rules
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    // Create a temp rule that should be cleaned
    const tempRulePath = resolve(projectPath, ".cursor", "rules", "_temp_mock.mdc");
    await mkdir(resolve(projectPath, ".cursor", "rules"), { recursive: true });
    await writeFile(tempRulePath, "---\nalwaysApply: true\n---\n# Temp Mock Rule\n");

    // Verify temp file exists
    await expect(access(tempRulePath)).resolves.toBeNull();

    // Apply with override
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "project",
      override: true,
    });

    expect(["success", "unchanged"]).toContain(result.status);

    // Verify temp file is gone
    const ruleExists = await access(tempRulePath)
      .then(() => true)
      .catch(() => false);
    expect(ruleExists).toBe(false);

    // Verify rules directory exists
    await expect(access(resolve(projectPath, ".cursor", "rules"))).resolves.toBeNull();
  });
});

describe("CursorAdapter stale rule pruning", () => {
  let projectPath: string;
  let adapter: CursorAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "cursor-prune-"));
    await writeApplyFixtures(projectPath);
    adapter = new CursorAdapter();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("removes a rule file a previous apply wrote when this apply renders no rules", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const rulesDir = resolve(projectPath, ".cursor", "rules");
    await access(rulesDir);

    // Simulate a profile change: rules directory exists but this apply has no rules to render.
    const { readdir } = await import("node:fs/promises");
    const stale = (await readdir(rulesDir)).filter((name) => name.endsWith(".mdc"));
    expect(stale.length).toBeGreaterThan(0);

    const { syncRulesAsFiles } = await import("@/infrastructure/features/apply/adapters/PlatformSyncUtils");
    const result = await syncRulesAsFiles(
      [],
      rulesDir,
      (rule, content) => ({ relativePath: `${rule.id}.mdc`, content }),
      false
    );
    expect(result.paths.length).toBe(stale.length);
    await expect(access(resolve(rulesDir, stale[0]))).rejects.toThrow();
  });

  it("keeps user-authored files with unknown extensions while pruning rule files", async () => {
    const rulesDir = resolve(projectPath, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      resolve(rulesDir, "old-rule.mdc"),
      "---\nalwaysApply: true\n---\n<!-- agent-ctrl:managed -->\n# Old\n"
    );
    await writeFile(resolve(rulesDir, "notes.txt"), "user notes");

    const { syncRulesAsFiles } = await import("@/infrastructure/features/apply/adapters/PlatformSyncUtils");
    await syncRulesAsFiles([], rulesDir, (rule, content) => ({ relativePath: `${rule.id}.mdc`, content }), false);

    await expect(access(resolve(rulesDir, "old-rule.mdc"))).rejects.toThrow();
    await expect(access(resolve(rulesDir, "notes.txt"))).resolves.toBeNull();
  });

  it("keeps a hand-written rule file, with or without frontmatter, and lists it as unmanaged", async () => {
    const rulesDir = resolve(projectPath, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(resolve(rulesDir, "mine.mdc"), "---\nalwaysApply: true\n---\n# Mine\n");
    await writeFile(resolve(rulesDir, "plain.md"), "# Plain note\n");
    await writeFile(
      resolve(rulesDir, "old-rule.mdc"),
      "---\nalwaysApply: true\n---\n<!-- agent-ctrl:managed -->\n# Old\n"
    );

    const { syncRulesAsFiles } = await import("@/infrastructure/features/apply/adapters/PlatformSyncUtils");
    const result = await syncRulesAsFiles(
      [],
      rulesDir,
      (rule, content) => ({ relativePath: `${rule.id}.mdc`, content }),
      false
    );

    await expect(access(resolve(rulesDir, "mine.mdc"))).resolves.toBeNull();
    await expect(access(resolve(rulesDir, "plain.md"))).resolves.toBeNull();
    await expect(access(resolve(rulesDir, "old-rule.mdc"))).rejects.toThrow();
    expect(result.warnings.join("\n")).toContain("Unmanaged rule files kept");
    expect(result.warnings.join("\n")).toContain("mine.mdc");
    expect(result.warnings.join("\n")).not.toContain("old-rule.mdc");
  });

  it("marks the rule files it renders, after the frontmatter, so a later apply may prune them", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const rulesDir = resolve(projectPath, ".cursor", "rules");

    const { readdir, readFile } = await import("node:fs/promises");
    const [first] = (await readdir(rulesDir)).filter((name) => name.endsWith(".mdc"));
    const content = await readFile(resolve(rulesDir, first), "utf-8");

    expect(content.startsWith("---\nalwaysApply: true\n---\n<!-- agent-ctrl:managed -->\n")).toBe(true);
  });

  it("does not delete a stale file on a dry run", async () => {
    const rulesDir = resolve(projectPath, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(resolve(rulesDir, "old-rule.mdc"), "<!-- agent-ctrl:managed -->\n# Old\n");

    const { syncRulesAsFiles } = await import("@/infrastructure/features/apply/adapters/PlatformSyncUtils");
    const result = await syncRulesAsFiles(
      [],
      rulesDir,
      (rule, content) => ({ relativePath: `${rule.id}.mdc`, content }),
      true
    );

    expect(result.paths).toEqual([resolve(rulesDir, "old-rule.mdc")]);
    await expect(access(resolve(rulesDir, "old-rule.mdc"))).resolves.toBeNull();
  });
});
