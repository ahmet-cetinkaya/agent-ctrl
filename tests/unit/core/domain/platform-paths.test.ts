import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  resolvePlatformConfigPath,
  resolveMultiplePlatformPaths,
  getGlobalCopySupportedPlatforms,
} from "@/core/domain/platform-paths.js";

describe("Platform Config Path Resolution", () => {
  describe("resolvePlatformConfigPath", () => {
    describe("claude platform", () => {
      it("should resolve default path when no env var set", () => {
        const originalEnv = process.env.CLAUDE_CONFIG_DIR;
        delete process.env.CLAUDE_CONFIG_DIR;

        const result = resolvePlatformConfigPath("claude");

        expect(result.platform).toBe("claude");
        expect(result.resolvedVia).toBe("default");
        expect(result.envVarUsed).toBeNull();
        expect(result.supportsGlobalCopy).toBe(true);
        expect(result.resolvedPath).toContain(".claude");

        process.env.CLAUDE_CONFIG_DIR = originalEnv;
      });

      it("should use CLAUDE_CONFIG_DIR when set", () => {
        const originalEnv = process.env.CLAUDE_CONFIG_DIR;
        process.env.CLAUDE_CONFIG_DIR = "/custom/claude";

        const result = resolvePlatformConfigPath("claude");

        expect(result.platform).toBe("claude");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("CLAUDE_CONFIG_DIR");
        expect(result.resolvedPath).toBe("/custom/claude");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.CLAUDE_CONFIG_DIR = originalEnv;
      });
    });

    describe("codex platform", () => {
      it("should resolve default path when no env var set", () => {
        const originalEnv = process.env.CODEX_HOME;
        delete process.env.CODEX_HOME;

        const result = resolvePlatformConfigPath("codex");

        expect(result.platform).toBe("codex");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".codex");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.CODEX_HOME = originalEnv;
      });

      it("should use CODEX_HOME when set", () => {
        const originalEnv = process.env.CODEX_HOME;
        process.env.CODEX_HOME = "/custom/codex";

        const result = resolvePlatformConfigPath("codex");

        expect(result.platform).toBe("codex");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("CODEX_HOME");
        expect(result.resolvedPath).toBe("/custom/codex");

        process.env.CODEX_HOME = originalEnv;
      });
    });

    describe("gemini platform", () => {
      it("should resolve default path when no env var set", () => {
        const originalEnv = process.env.GEMINI_CONFIG_DIR;
        delete process.env.GEMINI_CONFIG_DIR;

        const result = resolvePlatformConfigPath("gemini");

        expect(result.platform).toBe("gemini");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".gemini");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.GEMINI_CONFIG_DIR = originalEnv;
      });

      it("should use GEMINI_CONFIG_DIR when set", () => {
        const originalEnv = process.env.GEMINI_CONFIG_DIR;
        process.env.GEMINI_CONFIG_DIR = "/custom/gemini";

        const result = resolvePlatformConfigPath("gemini");

        expect(result.platform).toBe("gemini");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("GEMINI_CONFIG_DIR");
        expect(result.resolvedPath).toBe("/custom/gemini");

        process.env.GEMINI_CONFIG_DIR = originalEnv;
      });
    });

    describe("antigravity platform", () => {
      it("should resolve to antigravity subdirectory of gemini root by default", () => {
        const originalEnv = process.env.GEMINI_CONFIG_DIR;
        delete process.env.GEMINI_CONFIG_DIR;

        const result = resolvePlatformConfigPath("antigravity");

        expect(result.platform).toBe("antigravity");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".gemini/antigravity");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.GEMINI_CONFIG_DIR = originalEnv;
      });

      it("should inherit GEMINI_CONFIG_DIR when set", () => {
        const originalEnv = process.env.GEMINI_CONFIG_DIR;
        process.env.GEMINI_CONFIG_DIR = "/custom/gemini";

        const result = resolvePlatformConfigPath("antigravity");

        expect(result.platform).toBe("antigravity");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("GEMINI_CONFIG_DIR");
        expect(result.resolvedPath).toBe("/custom/gemini/antigravity");

        process.env.GEMINI_CONFIG_DIR = originalEnv;
      });
    });

    describe("opencode platform", () => {
      it("should resolve default path when no overrides set", () => {
        const originalEnvs = {
          OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
          XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
        };
        delete process.env.OPENCODE_CONFIG_DIR;
        delete process.env.XDG_CONFIG_HOME;

        const result = resolvePlatformConfigPath("opencode");

        expect(result.platform).toBe("opencode");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".config/opencode");
        expect(result.supportsGlobalCopy).toBe(true);

        Object.assign(process.env, originalEnvs);
      });

      it("should use OPENCODE_CONFIG_DIR when set (highest priority)", () => {
        const originalEnv = process.env.OPENCODE_CONFIG_DIR;
        process.env.OPENCODE_CONFIG_DIR = "/custom/opencode";

        const result = resolvePlatformConfigPath("opencode");

        expect(result.platform).toBe("opencode");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("OPENCODE_CONFIG_DIR");
        expect(result.resolvedPath).toBe("/custom/opencode");

        process.env.OPENCODE_CONFIG_DIR = originalEnv;
      });

      it("should use XDG_CONFIG_HOME when OPENCODE_CONFIG_DIR not set", () => {
        const originalEnvs = {
          OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
          XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
        };
        delete process.env.OPENCODE_CONFIG_DIR;
        process.env.XDG_CONFIG_HOME = "/custom/xdg";

        const result = resolvePlatformConfigPath("opencode");

        expect(result.platform).toBe("opencode");
        expect(result.resolvedVia).toBe("xdg");
        expect(result.envVarUsed).toBeNull();
        expect(result.resolvedPath).toBe("/custom/xdg/opencode");

        Object.assign(process.env, originalEnvs);
      });
    });

    describe("kilo platform", () => {
      it("should resolve default path when no XDG set", () => {
        const originalEnv = process.env.XDG_CONFIG_HOME;
        delete process.env.XDG_CONFIG_HOME;

        const result = resolvePlatformConfigPath("kilo");

        expect(result.platform).toBe("kilo");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".config/kilo");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.XDG_CONFIG_HOME = originalEnv;
      });

      it("should use XDG_CONFIG_HOME when set", () => {
        const originalEnv = process.env.XDG_CONFIG_HOME;
        process.env.XDG_CONFIG_HOME = "/custom/xdg";

        const result = resolvePlatformConfigPath("kilo");

        expect(result.platform).toBe("kilo");
        expect(result.resolvedVia).toBe("xdg");
        expect(result.envVarUsed).toBeNull();
        expect(result.resolvedPath).toBe("/custom/xdg/kilo");

        process.env.XDG_CONFIG_HOME = originalEnv;
      });
    });

    describe("qwen platform", () => {
      it("should resolve default path", () => {
        const result = resolvePlatformConfigPath("qwen");

        expect(result.platform).toBe("qwen");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".qwen");
        expect(result.supportsGlobalCopy).toBe(true);
      });
    });

    describe("windsurf platform", () => {
      it("should resolve default path", () => {
        const result = resolvePlatformConfigPath("windsurf");

        expect(result.platform).toBe("windsurf");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain(".codeium");
        expect(result.supportsGlobalCopy).toBe(true);
      });
    });

    describe("forgecode platform", () => {
      it("should resolve default path when no env var set", () => {
        const originalEnv = process.env.FORGE_CONFIG;
        delete process.env.FORGE_CONFIG;

        const result = resolvePlatformConfigPath("forgecode");

        expect(result.platform).toBe("forgecode");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toContain("/forge");
        expect(result.supportsGlobalCopy).toBe(true);

        process.env.FORGE_CONFIG = originalEnv;
      });

      it("should use FORGE_CONFIG when set", () => {
        const originalEnv = process.env.FORGE_CONFIG;
        process.env.FORGE_CONFIG = "/custom/forge";

        const result = resolvePlatformConfigPath("forgecode");

        expect(result.platform).toBe("forgecode");
        expect(result.resolvedVia).toBe("env_var");
        expect(result.envVarUsed).toBe("FORGE_CONFIG");
        expect(result.resolvedPath).toBe("/custom/forge");

        process.env.FORGE_CONFIG = originalEnv;
      });
    });

    describe("cursor platform", () => {
      it("should resolve to project-local path only", () => {
        const result = resolvePlatformConfigPath("cursor");

        expect(result.platform).toBe("cursor");
        expect(result.resolvedVia).toBe("default");
        expect(result.resolvedPath).toBe(".cursor");
        expect(result.supportsGlobalCopy).toBe(false); // Global copy NOT supported
      });

      it("should not support environment variable override", () => {
        const result = resolvePlatformConfigPath("cursor");

        expect(result.envVarUsed).toBeNull();
        expect(result.resolvedPath).toBe(".cursor");
      });
    });
  });

  describe("resolveMultiplePlatformPaths", () => {
    it("should resolve paths for multiple platforms", () => {
      const platforms: Array<"claude" | "gemini" | "cursor"> = ["claude", "gemini", "cursor"];
      const results = resolveMultiplePlatformPaths(platforms);

      expect(results).toHaveLength(3);
      expect(results[0].platform).toBe("claude");
      expect(results[1].platform).toBe("gemini");
      expect(results[2].platform).toBe("cursor");
    });

    it("should preserve platform order in results", () => {
      const platforms: Array<"claude" | "codex" | "gemini"> = ["gemini", "claude", "codex"];
      const results = resolveMultiplePlatformPaths(platforms);

      expect(results[0].platform).toBe("gemini");
      expect(results[1].platform).toBe("claude");
      expect(results[2].platform).toBe("codex");
    });

    it("should handle all 10 supported platforms", () => {
      const platforms: Array<
        | "antigravity"
        | "claude"
        | "codex"
        | "cursor"
        | "forgecode"
        | "gemini"
        | "kilo"
        | "opencode"
        | "qwen"
        | "windsurf"
      > = ["antigravity", "claude", "codex", "cursor", "forgecode", "gemini", "kilo", "opencode", "qwen", "windsurf"];
      const results = resolveMultiplePlatformPaths(platforms);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r.platform !== null)).toBe(true);
    });

    it("should handle empty array", () => {
      const results = resolveMultiplePlatformPaths([]);
      expect(results).toHaveLength(0);
    });
  });

  describe("getGlobalCopySupportedPlatforms", () => {
    it("should return all platforms except cursor (which only supports project-local)", () => {
      const platforms = getGlobalCopySupportedPlatforms();

      expect(platforms.length).toBe(9); // All except cursor
      expect(platforms).not.toContain("cursor");
      expect(platforms).toContain("claude");
      expect(platforms).toContain("gemini");
      expect(platforms).toContain("antigravity");
    });

    it("should include antigravity (shares gemini root but supports global copy)", () => {
      const platforms = getGlobalCopySupportedPlatforms();

      expect(platforms).toContain("antigravity");
    });

    it("should return consistent results across calls", () => {
      const result1 = getGlobalCopySupportedPlatforms();
      const result2 = getGlobalCopySupportedPlatforms();

      expect(result1).toEqual(result2);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle missing HOME environment variable", () => {
      const originalHome = process.env.HOME;
      delete process.env.HOME;

      // Should not throw, should handle gracefully
      expect(() => resolvePlatformConfigPath("claude")).not.toThrow();

      process.env.HOME = originalHome;
    });

    it("should handle empty environment variable values", () => {
      const originalEnv = process.env.CLAUDE_CONFIG_DIR;
      process.env.CLAUDE_CONFIG_DIR = "";

      const result = resolvePlatformConfigPath("claude");

      // Empty string should still set env_var mode
      expect(result.resolvedVia).toBe("env_var");

      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    });

    it("should preserve environment variable precedence order", () => {
      const originalEnvs = {
        OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      };

      process.env.OPENCODE_CONFIG_DIR = "/opencode-env";
      process.env.XDG_CONFIG_HOME = "/xdg-env";

      const result = resolvePlatformConfigPath("opencode");

      expect(result.resolvedVia).toBe("env_var");
      expect(result.envVarUsed).toBe("OPENCODE_CONFIG_DIR");
      expect(result.resolvedPath).toBe("/opencode-env");

      Object.assign(process.env, originalEnvs);
    });

    it("should handle whitespace in environment variable values", () => {
      const originalEnv = process.env.CLAUDE_CONFIG_DIR;
      process.env.CLAUDE_CONFIG_DIR = "  /custom/claude  ";

      const result = resolvePlatformConfigPath("claude");

      expect(result.resolvedPath).toBe("  /custom/claude  ");

      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    });
  });

  describe("antigravity-gemini path isolation", () => {
    it("should isolate antigravity content under antigravity subdirectory", () => {
      const antigravityResult = resolvePlatformConfigPath("antigravity");
      const geminiResult = resolvePlatformConfigPath("gemini");

      expect(antigravityResult.resolvedPath).toContain("/antigravity");
      expect(geminiResult.resolvedPath).not.toContain("/antigravity");

      // Antigravity should share gemini's root but be isolated
      const geminiRoot = geminiResult.resolvedPath;
      const antigravityPath = antigravityResult.resolvedPath;

      expect(antigravityPath.startsWith(geminiRoot)).toBe(true);
      expect(antigravityPath).toBe(`${geminiRoot}/antigravity`);
    });

    it("should inherit gemini env var for antigravity resolution", () => {
      const originalEnv = process.env.GEMINI_CONFIG_DIR;
      process.env.GEMINI_CONFIG_DIR = "/custom/gemini";

      const antigravityResult = resolvePlatformConfigPath("antigravity");
      const geminiResult = resolvePlatformConfigPath("gemini");

      expect(antigravityResult.resolvedPath).toBe("/custom/gemini/antigravity");
      expect(geminiResult.resolvedPath).toBe("/custom/gemini");
      expect(antigravityResult.envVarUsed).toBe("GEMINI_CONFIG_DIR");

      process.env.GEMINI_CONFIG_DIR = originalEnv;
    });
  });
});
