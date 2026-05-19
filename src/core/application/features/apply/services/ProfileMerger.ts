import type { ApplyMcpServer, ApplySourceSnapshot } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";

export interface MergeResult {
  snapshot: ApplySourceSnapshot;
  isEmpty: boolean;
  replacedDirectories: {
    skills: boolean;
    commands: boolean;
  };
}

export class ProfileMerger {
  merge(base: ApplySourceSnapshot, profile: ApplySourceSnapshot): MergeResult {
    const rules = this.mergeRules(base.rules, profile.rules);
    const skills = this.mergeSkills(base.skills, profile.skills);
    const agents = this.mergeAgents(base.agents, profile.agents);
    const commands = this.mergeCommands(base.commands, profile.commands);
    const mcpServers = this.mergeMcpServers(base.mcpServers, profile.mcpServers);
    const warnings = [...base.warnings, ...profile.warnings];

    const isEmpty =
      profile.rules.length === 0 &&
      profile.skills.length === 0 &&
      profile.agents.length === 0 &&
      profile.commands.length === 0 &&
      profile.mcpServers.length === 0;

    return {
      snapshot: {
        rules,
        skills,
        agents,
        commands,
        mcpServers,
        warnings,
      },
      isEmpty,
      replacedDirectories: {
        skills: profile.skills.length > 0,
        commands: profile.commands.length > 0,
      },
    };
  }

  private mergeRules(base: Rule[], profile: Rule[]): Rule[] {
    const baseByName = new Map(base.map((rule) => [rule.filename, rule]));
    for (const profileRule of profile) {
      baseByName.set(profileRule.filename, profileRule);
    }
    return [...baseByName.values()];
  }

  private mergeSkills(base: Skill[], profile: Skill[]): Skill[] {
    if (profile.length > 0) {
      return [...profile];
    }
    return [...base];
  }

  private mergeAgents(base: Agent[], profile: Agent[]): Agent[] {
    const baseByName = new Map(base.map((agent) => [agent.filename, agent]));
    for (const profileAgent of profile) {
      baseByName.set(profileAgent.filename, profileAgent);
    }
    return [...baseByName.values()];
  }

  private mergeCommands(base: CommandArtifact[], profile: CommandArtifact[]): CommandArtifact[] {
    if (profile.length > 0) {
      return [...profile];
    }
    return [...base];
  }

  private mergeMcpServers(base: ApplyMcpServer[], profile: ApplyMcpServer[]): ApplyMcpServer[] {
    const baseByName = new Map(base.map((server) => [server.name, server]));

    for (const profileServer of profile) {
      const existing = baseByName.get(profileServer.name);
      if (existing) {
        baseByName.set(profileServer.name, this.mergeMcpServerFields(existing, profileServer));
      } else {
        baseByName.set(profileServer.name, profileServer);
      }
    }

    return [...baseByName.values()];
  }

  private mergeMcpServerFields(base: ApplyMcpServer, profile: ApplyMcpServer): ApplyMcpServer {
    const merged = { ...base };

    if (profile.transport) merged.transport = profile.transport;
    if (profile.sourceFile) merged.sourceFile = profile.sourceFile;

    if (profile.command !== undefined) merged.command = profile.command;
    if (profile.args !== undefined) merged.args = profile.args;
    if (profile.cwd !== undefined) merged.cwd = profile.cwd;
    if (profile.env !== undefined) merged.env = profile.env;
    if (profile.url !== undefined) merged.url = profile.url;

    return merged;
  }
}
