import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
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

  it("passes default user scope and default ~/.agent-ctrl path into apply command", async () => {
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
          surface: "commands",
          message: "ok",
          durationMs: 1,
          warnings: [],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "opencode", "--dry-run"]);
    const call = captured[0] as { targetScope: string; userConfigRootPath: string; projectPath: string };
    expect(call.targetScope).toBe("user");
    expect(call.projectPath).toBe(resolve(cwdPath));
    expect(call.userConfigRootPath).toContain(".agent-ctrl");
  });

  it("passes project scope and custom path when requested", async () => {
    const captured: unknown[] = [];
    ApplyCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          platform: "qwen",
          status: "success",
          configPath: "/tmp/config",
          scope: "project",
          surface: "commands-toml",
          message: "ok",
          durationMs: 1,
          warnings: [],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "qwen", "--project", "--path", "/tmp/custom-root", "--dry-run"]);
    const call = captured[0] as { targetScope: string; userConfigRootPath: string };
    expect(call.targetScope).toBe("project");
    expect(call.userConfigRootPath).toBe(resolve("/tmp/custom-root"));
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

  it("exits with code 2 for unexpected thrown errors", async () => {
    ApplyCommand.prototype.execute = async function mockedExecute() {
      throw new Error("boom");
    };

    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createApplyCommand().parseAsync(["node", "test", "opencode"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("Unexpected error"))).toBe(true);
  });

  it("renders non-dry-run unchanged output and warnings", async () => {
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: true,
        data: {
          platform: "gemini",
          status: "unchanged",
          configPath: "/tmp/config",
          scope: "user",
          surface: "commands-toml",
          message: "ok",
          durationMs: 3,
          warnings: ["warn-1"],
        },
      };
    };

    await createApplyCommand().parseAsync(["node", "test", "gemini"]);
    expect(logs.some((line) => line.includes("unchanged"))).toBe(true);
    expect(logs.some((line) => line.includes("Warnings:"))).toBe(true);
    expect(logs.some((line) => line.includes("warn-1"))).toBe(true);
  });

  it("handles non-domain errors from command result with fallback exit path", async () => {
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new Error("unexpected-shape"),
      };
    };

    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createApplyCommand().parseAsync(["node", "test", "opencode"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("Unexpected error"))).toBe(true);
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
});
