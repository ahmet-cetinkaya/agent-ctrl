import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { InitCommand } from "@/core/application/features/init/commands/InitCommand";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";

describe("InitCommand", () => {
  let testDir: string;
  let fileSystem: NodeFileSystem;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `agent-ctrl-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    fileSystem = new NodeFileSystem();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("should initialize a project successfully", async () => {
    const initCommand = new InitCommand(fileSystem);
    const result = await initCommand.execute({ targetPath: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdDirectories).toContain("rules");
      expect(result.data.createdDirectories).toContain("skills");
      expect(result.data.createdDirectories).toContain("agents");
      expect(result.data.createdDirectories).toContain("commands");
      expect(result.data.createdDirectories).toContain(".agent-ctrl/mcps");
      expect(result.data.createdFiles).toContain("rules/.gitkeep");
      expect(result.data.createdFiles).toContain("skills/.gitkeep");
      expect(result.data.createdFiles).toContain("agents/.gitkeep");
      expect(result.data.createdFiles).toContain("commands/.gitkeep");
      expect(result.data.createdFiles).toContain(".agent-ctrl/mcps/.gitkeep");
      expect(result.data.createdFiles).toContain(".agent-ctrl/.env");
      expect(result.data.createdFiles).toContain(".agent-ctrl/.env.example");
      expect(result.data.createdFiles).toContain(".agent-ctrl/.gitignore");
      expect(result.data.createdFiles).toContain("README.md");
    }

    const mcpDirExists = await access(resolve(testDir, ".agent-ctrl", "mcps")).then(
      () => true,
      () => false,
    );
    expect(mcpDirExists).toBe(true);

    const gitkeepPaths = [
      resolve(testDir, "rules", ".gitkeep"),
      resolve(testDir, "skills", ".gitkeep"),
      resolve(testDir, "agents", ".gitkeep"),
      resolve(testDir, "commands", ".gitkeep"),
      resolve(testDir, ".agent-ctrl", "mcps", ".gitkeep"),
    ];

    for (const path of gitkeepPaths) {
      const exists = await access(path).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(true);
    }

    const envPath = resolve(testDir, ".agent-ctrl", ".env");
    const envExamplePath = resolve(testDir, ".agent-ctrl", ".env.example");
    const configGitignorePath = resolve(testDir, ".agent-ctrl", ".gitignore");
    expect(await readFile(envPath, "utf-8")).toContain("https://skillsmp.com/docs/api");
    expect(await readFile(envPath, "utf-8")).toContain("https://smithery.ai/account/api-keys");
    expect(await readFile(envPath, "utf-8")).toContain("SKILLSMP_API_KEY=");
    expect(await readFile(envPath, "utf-8")).toContain("SMITHERY_API_KEY=");
    expect(await readFile(envExamplePath, "utf-8")).toContain("https://skillsmp.com/docs/api");
    expect(await readFile(envExamplePath, "utf-8")).toContain("https://smithery.ai/account/api-keys");
    expect(await readFile(envExamplePath, "utf-8")).toContain("SKILLSMP_API_KEY=your-skillsmp-api-key");
    expect(await readFile(envExamplePath, "utf-8")).toContain("SMITHERY_API_KEY=your-smithery-api-key");
    expect(await readFile(configGitignorePath, "utf-8")).toContain(".env");

    const readmePath = resolve(testDir, "README.md");
    const readmeExists = await access(readmePath).then(
      () => true,
      () => false,
    );
    expect(readmeExists).toBe(true);
    const readmeContent = await readFile(readmePath, "utf-8");
    expect(readmeContent).toContain("# agent-ctrl configuration");
    expect(readmeContent).toContain("agent-ctrl is a CLI tool for managing AI agent configurations");
    expect(readmeContent).toContain("https://github.com/ahmet-cetinkaya/agent-ctrl");
    expect(readmeContent).toContain(".agent-ctrl/.env");
  });

  it("should fail on non-empty directory", async () => {
    const initCommand = new InitCommand(fileSystem);
    
    await initCommand.execute({ targetPath: testDir });
    
    const result = await initCommand.execute({ targetPath: testDir });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("--override");
    }
  });

  it("should allow initialization in a non-empty directory when override is enabled", async () => {
    const initCommand = new InitCommand(fileSystem);

    await initCommand.execute({ targetPath: testDir });

    const result = await initCommand.execute({ targetPath: testDir, override: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdFiles).toContain("README.md");
      expect(result.data.createdFiles).toContain(".agent-ctrl/.env");
    }
  });

  it("should create config files directly when target is config root", async () => {
    const targetConfigRoot = resolve(testDir, ".agent-ctrl");
    await mkdir(targetConfigRoot, { recursive: true });

    const initCommand = new InitCommand(fileSystem);
    const result = await initCommand.execute({ targetPath: targetConfigRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdDirectories).toContain("mcps");
      expect(result.data.createdDirectories).not.toContain(".agent-ctrl/mcps");
      expect(result.data.createdFiles).toContain("mcps/.gitkeep");
      expect(result.data.createdFiles).not.toContain(".agent-ctrl/mcps/.gitkeep");
      expect(result.data.createdFiles).toContain(".env");
      expect(result.data.createdFiles).toContain(".env.example");
      expect(result.data.createdFiles).toContain(".gitignore");
      expect(result.data.createdFiles).toContain("README.md");
    }

    const mcpDirExists = await access(resolve(targetConfigRoot, "mcps")).then(
      () => true,
      () => false,
    );
    expect(mcpDirExists).toBe(true);

    const nestedMcpDirExists = await access(resolve(targetConfigRoot, ".agent-ctrl", "mcps")).then(
      () => true,
      () => false,
    );
    expect(nestedMcpDirExists).toBe(false);
    expect(await readFile(resolve(targetConfigRoot, ".env"), "utf-8")).toContain("https://skillsmp.com/docs/api");
    expect(await readFile(resolve(targetConfigRoot, ".env"), "utf-8")).toContain("SKILLSMP_API_KEY=");
    expect(await readFile(resolve(targetConfigRoot, ".env.example"), "utf-8")).toContain(
      "https://smithery.ai/account/api-keys"
    );
    expect(await readFile(resolve(targetConfigRoot, ".env.example"), "utf-8")).toContain("SMITHERY_API_KEY=");
    expect(await readFile(resolve(targetConfigRoot, ".gitignore"), "utf-8")).toContain(".env");
  });
});
