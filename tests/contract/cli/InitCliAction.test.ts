import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { InitCommand } from "@/core/application/features/init/commands/InitCommand";
import { createInitCommand } from "@/presentation/cli/features/init/commands/init";

describe("Init CLI action behavior", () => {
  let originalExecute: InitCommand["execute"];
  let originalLog: typeof console.log;
  const logs: string[] = [];

  beforeEach(() => {
    originalExecute = InitCommand.prototype.execute;
    originalLog = console.log;

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    InitCommand.prototype.execute = originalExecute;
    console.log = originalLog;
    logs.length = 0;
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
});
