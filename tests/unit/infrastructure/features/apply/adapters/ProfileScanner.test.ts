import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProfileScanner } from "@/infrastructure/features/apply/adapters/ProfileScanner";

describe("ProfileScanner", () => {
  let profilePath: string;
  let scanner: ProfileScanner;

  beforeEach(async () => {
    profilePath = join(tmpdir(), `profile-scanner-${Date.now()}`);
    scanner = new ProfileScanner();
  });

  afterEach(async () => {
    await rm(profilePath, { recursive: true, force: true });
  });

  it("scans valid profile with all subdirectories", async () => {
    await mkdir(join(profilePath, "rules"), { recursive: true });
    await mkdir(join(profilePath, "skills", "test-skill"), { recursive: true });
    await mkdir(join(profilePath, "agents"), { recursive: true });
    await mkdir(join(profilePath, "commands", "test-cmd"), { recursive: true });

    await writeFile(join(profilePath, "rules", "test.md"), "# Test Rule\n", "utf-8");
    await writeFile(join(profilePath, "skills", "test-skill", "SKILL.md"), "# Test Skill\n", "utf-8");
    await writeFile(join(profilePath, "agents", "test-agent.md"), "# Test Agent\n", "utf-8");
    await writeFile(join(profilePath, "commands", "test-cmd", "cmd.md"), "# Test Command\n", "utf-8");

    const result = await scanner.scan(profilePath);

    expect(result.rules).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.agents).toHaveLength(1);
    expect(result.commands).toHaveLength(1);
  });

  it("scans profile with partial subdirectories", async () => {
    await mkdir(join(profilePath, "rules"), { recursive: true });
    await writeFile(join(profilePath, "rules", "test.md"), "# Test Rule\n", "utf-8");

    const result = await scanner.scan(profilePath);

    expect(result.rules).toHaveLength(1);
    expect(result.skills).toHaveLength(0);
    expect(result.agents).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
  });

  it("scans empty profile", async () => {
    await mkdir(profilePath, { recursive: true });

    const result = await scanner.scan(profilePath);

    expect(result.rules).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.agents).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
    expect(result.mcpServers).toHaveLength(0);
  });

  it("throws for non-existent path", async () => {
    const nonExistent = join(profilePath, "does-not-exist");

    await expect(scanner.scan(nonExistent)).rejects.toThrow("Profile directory does not exist");
  });

  it("throws when path is a file", async () => {
    await mkdir(profilePath, { recursive: true });
    const filePath = join(profilePath, "file.txt");
    await writeFile(filePath, "content", "utf-8");

    await expect(scanner.scan(filePath)).rejects.toThrow("Profile path is not a directory");
  });
});
