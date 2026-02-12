import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import type { IPlatformAdapter, PlatformConfig } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { Artifact } from "@/core/domain/shared/types/Artifact";
import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";

export class ClaudeAdapter implements IPlatformAdapter {
  readonly platformName = "claude";
  readonly configPath: string;

  constructor() {
    this.configPath = resolve(homedir(), ".claude", "config.json");
  }

  async generateConfig(artifacts: Artifact[]): Promise<PlatformConfig> {
    const config: PlatformConfig = {
      rules: [],
      skills: [],
      agents: [],
    };

    for (const artifact of artifacts) {
      switch (artifact.type) {
        case ArtifactType.RULE:
          config.rules.push({
            name: (artifact as Rule).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.SKILL:
          config.skills.push({
            name: (artifact as Skill).id,
            path: artifact.path,
          });
          break;
        case ArtifactType.AGENT:
          config.agents.push({
            name: (artifact as Agent).id,
            path: artifact.path,
          });
          break;
      }
    }

    return config;
  }

  async readExistingConfig(): Promise<PlatformConfig | null> {
    try {
      await access(this.configPath);
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        rules: parsed.rules || [],
        skills: parsed.skills || [],
        agents: parsed.agents || [],
      };
    } catch {
      return null;
    }
  }

  async writeConfig(config: PlatformConfig): Promise<void> {
    const configDir = resolve(homedir(), ".claude");

    try {
      await access(configDir);
    } catch {
      await mkdir(configDir, { recursive: true });
    }

    const content = JSON.stringify(config, null, 2);
    await writeFile(this.configPath, content, "utf-8");
  }

  mergeConfigs(existing: PlatformConfig | null, newConfig: PlatformConfig): PlatformConfig {
    if (!existing) {
      return newConfig;
    }

    const mergeByName = <T extends { name: string }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map<string, T>();
      existing.forEach((item) => map.set(item.name, item));
      incoming.forEach((item) => map.set(item.name, item));
      return Array.from(map.values());
    };

    return {
      rules: mergeByName(existing.rules, newConfig.rules),
      skills: mergeByName(existing.skills, newConfig.skills),
      agents: mergeByName(existing.agents, newConfig.agents),
    };
  }
}
