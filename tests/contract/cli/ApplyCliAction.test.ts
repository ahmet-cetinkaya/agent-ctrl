import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { createApplyCommand } from "@/presentation/cli/features/apply/commands/apply";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";

describe("Apply CLI action behavior", () => {
  let cwdPath: string;
  let originalCwd: string;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExit: typeof process.exit;
  let originalExecute: ApplyCommand["execute"];
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(async () => {
    cwdPath = await mkdtemp(join(tmpdir(), "apply-cli-action-"));
    originalCwd = process.cwd();
    process.chdir(cwdPath);

    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;
    originalExecute = ApplyCommand.prototype.execute;

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
  });

  afterEach(async () => {
    ApplyCommand.prototype.execute = originalExecute;
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    process.chdir(originalCwd);
    logs.length = 0;
    errors.length = 0;
    await rm(cwdPath, { recursive: true, force: true });
  });

  it("does not force scope when no scope flag is provided", async () => {
    const captured: unknown[] = [];
    ApplyCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          platform: "opencode",
          status: "success",
          configPath: "/tmp/config",
          scope: "user",
          surface: "agents-md-commands-skills-agents-mcp",
          message: "ok",
          durationMs: 1,
          fileChanges: ["/tmp/config"],
          warnings: [],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "opencode", "--dry-run"]);
    const call = captured[0] as { targetScope?: string; userConfigRootPath?: string; projectPath: string };
    expect(call.targetScope).toBeUndefined();
    // When no scope flag is provided, projectPath defaults to global config root (home directory)
    expect(call.projectPath).toBe(homedir());
    expect(call.userConfigRootPath).toBeUndefined();
  });

  it("passes user scope and custom path when requested", async () => {
    const captured: unknown[] = [];
    ApplyCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          platform: "gemini",
          status: "success",
          configPath: "/tmp/config",
          scope: "user",
          surface: "gemini-md-commands-skills-settings",
          message: "ok",
          durationMs: 1,
          fileChanges: ["/tmp/config"],
          warnings: [],
        },
      };
    };

    await createApplyCommand().parseAsync([
      "node",
      "test",
      "gemini",
      "--user",
      "--path",
      "/tmp/custom-root",
      "--dry-run",
    ]);
    const call = captured[0] as { targetScope: string; userConfigRootPath: string };
    expect(call.targetScope).toBe("user");
    expect(call.userConfigRootPath).toBe(resolve("/tmp/custom-root"));
  });

  it("accepts --path without forcing explicit user scope", async () => {
    const captured: unknown[] = [];
    ApplyCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          platform: "opencode",
          status: "success",
          configPath: "/tmp/config",
          scope: "user",
          surface: "agents-md-commands-skills-agents-mcp",
          message: "ok",
          durationMs: 1,
          fileChanges: ["/tmp/config"],
          warnings: [],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "opencode", "--path", "/tmp/x", "--dry-run"]);
    const call = captured[0] as { targetScope?: string; userConfigRootPath?: string };
    expect(call.targetScope).toBeUndefined();
    expect(call.userConfigRootPath).toBe(resolve("/tmp/x"));
  });

  it("rejects --path together with --project", async () => {
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(
      createApplyCommand().parseAsync(["node", "test", "opencode", "--project", "--path", "/tmp/x"])
    ).rejects.toThrow("EXIT:1");
  });

  it("prints user-facing error details when apply command returns user error", async () => {
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new UserError("invalid usage"),
      };
    };

    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createApplyCommand().parseAsync(["node", "test", "opencode"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("invalid usage"))).toBe(true);
  });

  it("handles explicit SystemError with system exit semantics", async () => {
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new SystemError("system failure"),
      };
    };

    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createApplyCommand().parseAsync(["node", "test", "opencode"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("system failure"))).toBe(true);
  });

  it("prints file changes and suppresses warnings by default", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "test", "opencode"];

    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: true,
        data: {
          platform: "codex",
          status: "success",
          configPath: "/tmp/config",
          scope: "user",
          surface: "agents-md-prompts-skills-config-toml",
          message: "ok",
          durationMs: 1,
          fileChanges: ["/tmp/config", "/tmp/skills/example/SKILL.md"],
          warnings: ["hidden warning"],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "codex"]);

    expect(logs.some((line) => line === "Files:")).toBe(true);
    expect(logs.some((line) => line.includes("/tmp/skills/example/SKILL.md"))).toBe(true);
    expect(logs.some((line) => line.includes("Warnings:"))).toBe(false);

    process.argv = originalArgv;
  });

  it("prints warnings only when verbose is enabled", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "test", "--verbose", "codex"];

    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: true,
        data: {
          platform: "codex",
          status: "success",
          configPath: "/tmp/config",
          scope: "user",
          surface: "agents-md-prompts-skills-config-toml",
          message: "ok",
          durationMs: 1,
          fileChanges: ["/tmp/config"],
          warnings: ["visible warning"],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "codex"]);

    expect(logs.some((line) => line.includes("Warnings:"))).toBe(true);
    expect(logs.some((line) => line.includes("visible warning"))).toBe(true);

    process.argv = originalArgv;
  });
});
