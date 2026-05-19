import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { createApplyCommand } from "@/presentation/cli/features/apply/commands/apply";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { captureConsole, cleanupTempDir } from "../../helpers/catalogTestUtils";

describe("Apply CLI action behavior", () => {
  let cwdPath: string;
  let originalCwd: string;
  let originalArgv: string[];
  let consoleCapture: ReturnType<typeof captureConsole>;

  beforeEach(async () => {
    cwdPath = await mkdtemp(join(tmpdir(), "apply-cli-action-"));
    originalCwd = process.cwd();
    process.chdir(cwdPath);

    originalArgv = process.argv.slice();

    consoleCapture = captureConsole();
  });

  afterEach(async () => {
    consoleCapture.restore();
    process.chdir(originalCwd);
    process.argv = originalArgv;
    await cleanupTempDir(cwdPath);
  });

  it("does not force scope when no scope flag is provided", async () => {
    const captured: unknown[] = [];
    const originalExecute = ApplyCommand.prototype.execute;
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

    try {
      await createApplyCommand().parseAsync(["node", "test", "opencode", "--dry-run", "--no-prompt"]);
      const call = captured[0] as { targetScope?: string; userConfigRootPath?: string; projectPath: string };
      expect(call.targetScope).toBeUndefined();
      expect(call.projectPath).toBe(homedir());
      expect(call.userConfigRootPath).toBeUndefined();
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
    }
  });

  it("passes user scope and custom path when requested", async () => {
    const captured: unknown[] = [];
    const originalExecute = ApplyCommand.prototype.execute;
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

    try {
      await createApplyCommand().parseAsync([
        "node",
        "test",
        "gemini",
        "--user",
        "--path",
        "/tmp/custom-root",
        "--dry-run",
        "--no-prompt",
      ]);
      const call = captured[0] as { targetScope: string; userConfigRootPath: string };
      expect(call.targetScope).toBe("user");
      expect(call.userConfigRootPath).toBe(resolve("/tmp/custom-root"));
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
    }
  });

  it("accepts --path without forcing explicit user scope", async () => {
    const captured: unknown[] = [];
    const originalExecute = ApplyCommand.prototype.execute;
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

    try {
      await createApplyCommand().parseAsync([
        "node",
        "test",
        "opencode",
        "--path",
        "/tmp/x",
        "--dry-run",
        "--no-prompt",
      ]);
      const call = captured[0] as { targetScope?: string; userConfigRootPath?: string };
      expect(call.targetScope).toBeUndefined();
      expect(call.userConfigRootPath).toBe(resolve("/tmp/x"));
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
    }
  });

  it("rejects --path together with --project", async () => {
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as typeof process.exit;

    await expect(
      createApplyCommand().parseAsync(["node", "test", "opencode", "--project", "--path", "/tmp/x"])
    ).rejects.toThrow("EXIT:");
  });

  it("prints user-facing error details when apply command returns user error", async () => {
    const originalExecute = ApplyCommand.prototype.execute;
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new UserError("invalid usage"),
      };
    };

    try {
      process.exit = ((code?: number) => {
        throw new Error(`EXIT:${String(code)}`);
      }) as typeof process.exit;

      await expect(createApplyCommand().parseAsync(["node", "test", "opencode", "--no-prompt"])).rejects.toThrow(
        "EXIT:2"
      );
      const allOutput = consoleCapture.logs.join(" ");
      expect(allOutput.includes("invalid usage")).toBe(true);
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
    }
  });

  it("handles explicit SystemError with system exit semantics", async () => {
    const originalExecute = ApplyCommand.prototype.execute;
    ApplyCommand.prototype.execute = async function mockedExecute() {
      return {
        success: false,
        error: new SystemError("system failure"),
      };
    };

    try {
      process.exit = ((code?: number) => {
        throw new Error(`EXIT:${String(code)}`);
      }) as typeof process.exit;

      await expect(createApplyCommand().parseAsync(["node", "test", "opencode", "--no-prompt"])).rejects.toThrow(
        "EXIT:2"
      );
      const allOutput = consoleCapture.logs.join(" ");
      expect(allOutput.includes("system failure")).toBe(true);
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
    }
  });

  it("prints file changes and warnings by default", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "test", "opencode"];

    const originalExecute = ApplyCommand.prototype.execute;
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
          warnings: ["example warning"],
          artifactCounts: {
            rules: 5,
            commands: 10,
            skills: 15,
            agents: 3,
            mcpServers: 2,
          },
        },
      };
    };

    try {
      await createApplyCommand().parseAsync(["node", "test", "codex", "--no-prompt"]);
      const allOutput = consoleCapture.logs.join(" ");
      const plainText = allOutput.replace(/\x1b\[[0-9;]*m/g, "").replace(/\s+/g, " ");
      expect(plainText).toContain("Artifacts:");
      expect(plainText).toContain("5 rules");
      expect(plainText).toContain("10 commands");
      expect(plainText).toContain("15 skills");
      expect(plainText).toContain("3 agents");
      expect(plainText).toContain("2 MCP servers");
      expect(plainText).toContain("Warnings:");
      expect(plainText).toContain("example warning");
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
      process.argv = originalArgv;
    }
  });

  it("prints warnings", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "apply", "codex"];

    const originalExecute = ApplyCommand.prototype.execute;
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

    try {
      try {
        await createApplyCommand().parseAsync(["node", "apply", "codex", "--no-prompt"]);
      } catch (e: unknown) {
        console.log("ERROR:", e instanceof Error ? e.message : String(e));
      }
      const allOutput = consoleCapture.logs.join(" ");
      expect(allOutput.includes("visible warning")).toBe(true);
    } finally {
      ApplyCommand.prototype.execute = originalExecute;
      process.argv = originalArgv;
    }
  });
});
