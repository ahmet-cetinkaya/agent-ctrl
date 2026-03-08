import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { InitCommand } from "@/core/application/features/init/commands/InitCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { createInitCommand } from "@/presentation/cli/features/init/commands/init";

describe("Init CLI action behavior", () => {
  let originalExecute: InitCommand["execute"];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExit: typeof process.exit;
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    originalExecute = InitCommand.prototype.execute;
    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    InitCommand.prototype.execute = originalExecute;
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    logs.length = 0;
    errors.length = 0;
  });

  it("passes default ~/.agent-ctrl path into init command", async () => {
    const captured: unknown[] = [];
    InitCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          createdDirectories: [],
          createdFiles: [],
        },
      };
    };

    await createInitCommand().parseAsync(["node", "test"]);
    const call = captured[0] as { targetPath: string };
    expect(call.targetPath).toBe(resolve(homedir(), ".agent-ctrl"));
  });

  it("passes custom path into init command when provided", async () => {
    const captured: unknown[] = [];
    InitCommand.prototype.execute = async function mockedExecute(options) {
      captured.push(options);
      return {
        success: true,
        data: {
          createdDirectories: [],
          createdFiles: [],
        },
      };
    };

    await createInitCommand().parseAsync(["node", "test", "/tmp/custom-agent-ctrl"]);
    const call = captured[0] as { targetPath: string };
    expect(call.targetPath).toBe(resolve("/tmp/custom-agent-ctrl"));
  });

  it("renders created directories/files on success", async () => {
    InitCommand.prototype.execute = async function mockedExecute() {
      return {
        success: true,
        data: {
          createdDirectories: ["rules", "skills"],
          createdFiles: ["rules/.gitkeep", "README.md"],
        },
      };
    };

    await createInitCommand().parseAsync(["node", "test", "/tmp/agent-ctrl-root"]);

    expect(logs.some((line) => line.includes("✓ Created rules/"))).toBe(true);
    expect(logs.some((line) => line.includes("✓ Created rules/.gitkeep"))).toBe(true);
    expect(logs.some((line) => line.includes("✓ Created README.md"))).toBe(true);
    expect(logs.some((line) => line.includes("Configuration root: /tmp/agent-ctrl-root"))).toBe(true);
    expect(logs.some((line) => line.includes("agent-ctrl rule ls"))).toBe(true);
  });

  it("handles command result user errors", async () => {
    InitCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new UserError("bad-init"),
      };
    };
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createInitCommand().parseAsync(["node", "test"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("bad-init"))).toBe(true);
  });

  it("handles thrown system errors", async () => {
    InitCommand.prototype.execute = async function mockedExecute() {
      throw new SystemError("system-init");
    };
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createInitCommand().parseAsync(["node", "test"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("system-init"))).toBe(true);
  });

  it("handles thrown unexpected errors", async () => {
    InitCommand.prototype.execute = async function mockedExecute() {
      throw new Error("unexpected-init");
    };
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createInitCommand().parseAsync(["node", "test"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("Unexpected error"))).toBe(true);
  });

  it("handles thrown unknown values", async () => {
    InitCommand.prototype.execute = async function mockedExecute() {
      throw "unknown-init";
    };
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;

    await expect(createInitCommand().parseAsync(["node", "test"])).rejects.toThrow("EXIT:2");
    expect(errors.some((line) => line.includes("Unknown error occurred"))).toBe(true);
  });
});
