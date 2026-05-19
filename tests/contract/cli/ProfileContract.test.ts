import { describe, it, expect } from "bun:test";
import { createProfileCommand } from "@/presentation/cli/features/profile/commands/profile";

describe("Profile Command Contract", () => {
  describe("command schema (T024)", () => {
    it("has apply subcommand", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");

      expect(applyCmd).toBeDefined();
      expect(applyCmd?.description()).toContain("Apply profile(s)");
    });

    it("has list subcommand", () => {
      const profileCmd = createProfileCommand();
      const listCmd = profileCmd.commands.find((c) => c.name() === "list");

      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toContain("List available profiles");
    });

    it("apply command accepts profile_name and platform arguments", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");

      const helpText = applyCmd?.helpInformation() || "";
      expect(helpText).toContain("profile_name");
      expect(helpText).toContain("platform");
    });

    it("apply command supports --dry-run option", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");
      const dryRunOption = applyCmd?.options.find((o) => o.short === "-d" || o.long === "--dry-run");

      expect(dryRunOption).toBeDefined();
    });

    it("apply command supports --override option", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");
      const overrideOption = applyCmd?.options.find((o) => o.short === "-o" || o.long === "--override");

      expect(overrideOption).toBeDefined();
    });

    it("apply command supports --verbose option", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");
      const verboseOption = applyCmd?.options.find((o) => o.short === "-v" || o.long === "--verbose");

      expect(verboseOption).toBeDefined();
    });

    it("apply command supports --no-prompt option", () => {
      const profileCmd = createProfileCommand();
      const applyCmd = profileCmd.commands.find((c) => c.name() === "apply");
      const promptOption = applyCmd?.options.find((o) => o.long === "--no-prompt");

      expect(promptOption).toBeDefined();
    });
  });
});
