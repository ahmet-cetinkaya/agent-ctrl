import { describe, it, expect } from "bun:test";
import { ProfileMerger } from "@/core/application/features/apply/services/ProfileMerger";
import type { ApplySourceSnapshot, ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";

function emptySnapshot(): ApplySourceSnapshot {
  return { rules: [], skills: [], agents: [], commands: [], mcpServers: [], warnings: [] };
}

function makeRule(filename: string): Rule {
  return { id: filename, filename, path: `/rules/${filename}`, type: ArtifactType.RULE };
}

function makeSkill(id: string): Skill {
  return { id, directoryName: id, path: `/skills/${id}`, type: ArtifactType.SKILL };
}

function makeAgent(filename: string): Agent {
  return { id: filename, filename, path: `/agents/${filename}`, type: ArtifactType.AGENT };
}

function makeCommand(id: string): CommandArtifact {
  return { id, filename: `${id}.md`, path: `/commands/${id}.md` };
}

function makeMcpServer(name: string, command: string, args: string[]): ApplyMcpServer {
  return { name, transport: "stdio", command, args, sourceFile: `/mcps/${name}.json` };
}

describe("ProfileMerger", () => {
  const merger = new ProfileMerger();

  describe("mergeRules", () => {
    it("returns base rules when profile has none", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        rules: [makeRule("coding-style.md"), makeRule("security.md")],
      };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.snapshot.rules).toHaveLength(2);
      expect(result.snapshot.rules.map((r) => r.filename)).toContain("coding-style.md");
      expect(result.snapshot.rules.map((r) => r.filename)).toContain("security.md");
    });

    it("overrides base rules with profile rules of same filename", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        rules: [makeRule("coding-style.md"), makeRule("security.md")],
      };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        rules: [makeRule("security.md")],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.rules).toHaveLength(2);
      const securityRule = result.snapshot.rules.find((r) => r.filename === "security.md");
      expect(securityRule?.path).toBe("/rules/security.md");
    });

    it("adds profile rules not in base", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), rules: [makeRule("coding-style.md")] };
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), rules: [makeRule("testing.md")] };

      const result = merger.merge(base, profile);

      expect(result.snapshot.rules).toHaveLength(2);
      expect(result.snapshot.rules.map((r) => r.filename)).toContain("testing.md");
    });
  });

  describe("mergeSkills", () => {
    it("returns base skills when profile has none", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        skills: [makeSkill("git-workflow"), makeSkill("testing")],
      };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.snapshot.skills).toHaveLength(2);
      expect(result.snapshot.skills.map((s) => s.id)).toContain("git-workflow");
      expect(result.snapshot.skills.map((s) => s.id)).toContain("testing");
    });

    it("replaces all base skills when profile has skills (directory-level override)", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        skills: [makeSkill("git-workflow"), makeSkill("testing")],
      };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        skills: [makeSkill("godot-master")],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.skills).toHaveLength(1);
      expect(result.snapshot.skills[0].id).toBe("godot-master");
      expect(result.replacedDirectories.skills).toBe(true);
    });

    it("marks replacedDirectories.skills when profile has skills", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), skills: [makeSkill("base-skill")] };
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), skills: [makeSkill("profile-skill")] };

      const result = merger.merge(base, profile);

      expect(result.replacedDirectories.skills).toBe(true);
    });

    it("marks replacedDirectories.skills as false when profile has no skills", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), skills: [makeSkill("base-skill")] };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.replacedDirectories.skills).toBe(false);
    });
  });

  describe("mergeCommands", () => {
    it("returns base commands when profile has none", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        commands: [makeCommand("dev"), makeCommand("build")],
      };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.snapshot.commands).toHaveLength(2);
      expect(result.snapshot.commands.map((c) => c.id)).toContain("dev");
      expect(result.snapshot.commands.map((c) => c.id)).toContain("build");
    });

    it("replaces all base commands when profile has commands (directory-level override)", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        commands: [makeCommand("dev"), makeCommand("build")],
      };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        commands: [makeCommand("profile-cmd")],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.commands).toHaveLength(1);
      expect(result.snapshot.commands[0].id).toBe("profile-cmd");
      expect(result.replacedDirectories.commands).toBe(true);
    });

    it("marks replacedDirectories.commands when profile has commands", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), commands: [makeCommand("base-cmd")] };
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), commands: [makeCommand("profile-cmd")] };

      const result = merger.merge(base, profile);

      expect(result.replacedDirectories.commands).toBe(true);
    });

    it("marks replacedDirectories.commands as false when profile has no commands", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), commands: [makeCommand("base-cmd")] };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.replacedDirectories.commands).toBe(false);
    });
  });

  describe("mergeAgents", () => {
    it("overrides base agents with profile agents of same filename", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        agents: [makeAgent("architect.md")],
      };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        agents: [makeAgent("architect.md")],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.agents).toHaveLength(1);
      expect(result.snapshot.agents[0].filename).toBe("architect.md");
    });

    it("adds profile agents not in base", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), agents: [makeAgent("architect.md")] };
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), agents: [makeAgent("reviewer.md")] };

      const result = merger.merge(base, profile);

      expect(result.snapshot.agents).toHaveLength(2);
      expect(result.snapshot.agents.map((a) => a.filename)).toContain("reviewer.md");
    });
  });

  describe("mergeMcpServers", () => {
    it("performs field-level merge for matching server keys", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        mcpServers: [makeMcpServer("context7", "npx", ["-y", "@upstash/context7-mcp"])],
      };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        mcpServers: [
          {
            name: "context7",
            transport: "stdio",
            command: "bun",
            args: ["run", "server"],
            sourceFile: "/mcps/context7.json",
          },
        ],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.mcpServers).toHaveLength(1);
      const merged = result.snapshot.mcpServers[0];
      expect(merged.command).toBe("bun");
      expect(merged.args).toEqual(["run", "server"]);
    });

    it("adds profile MCP servers not in base", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), mcpServers: [makeMcpServer("context7", "npx", [])] };
      const profile: ApplySourceSnapshot = {
        ...emptySnapshot(),
        mcpServers: [makeMcpServer("new-server", "node", ["server.js"])],
      };

      const result = merger.merge(base, profile);

      expect(result.snapshot.mcpServers).toHaveLength(2);
      expect(result.snapshot.mcpServers.map((s) => s.name)).toContain("context7");
      expect(result.snapshot.mcpServers.map((s) => s.name)).toContain("new-server");
    });
  });

  describe("empty profile detection", () => {
    it("returns isEmpty true when profile has no artifacts", () => {
      const base: ApplySourceSnapshot = {
        ...emptySnapshot(),
        rules: [makeRule("coding-style.md")],
      };
      const profile: ApplySourceSnapshot = emptySnapshot();

      const result = merger.merge(base, profile);

      expect(result.isEmpty).toBe(true);
      expect(result.snapshot.rules).toHaveLength(1);
    });

    it("returns isEmpty false when profile has at least one artifact", () => {
      const base: ApplySourceSnapshot = emptySnapshot();
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), rules: [makeRule("testing.md")] };

      const result = merger.merge(base, profile);

      expect(result.isEmpty).toBe(false);
    });
  });

  describe("warnings", () => {
    it("combines warnings from base and profile", () => {
      const base: ApplySourceSnapshot = { ...emptySnapshot(), warnings: ["base warning 1"] };
      const profile: ApplySourceSnapshot = { ...emptySnapshot(), warnings: ["profile warning 1"] };

      const result = merger.merge(base, profile);

      expect(result.snapshot.warnings).toContain("base warning 1");
      expect(result.snapshot.warnings).toContain("profile warning 1");
    });
  });
});
