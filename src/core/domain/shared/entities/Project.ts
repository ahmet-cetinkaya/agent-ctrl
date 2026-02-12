import type { Rule } from "./Rule";
import type { Skill } from "./Skill";
import type { Agent } from "./Agent";

export interface Project {
  rootPath: string;
  rulesPath: string;
  skillsPath: string;
  agentsPath: string;
  commandsPath: string;
  rules: Rule[];
  skills: Skill[];
  agents: Agent[];
}

export function createProject(rootPath: string): Project {
  return {
    rootPath,
    rulesPath: `${rootPath}/rules`,
    skillsPath: `${rootPath}/skills`,
    agentsPath: `${rootPath}/agents`,
    commandsPath: `${rootPath}/commands`,
    rules: [],
    skills: [],
    agents: [],
  };
}
