import { describe, it, expect } from "bun:test";
import { createProject } from "@/core/domain/shared/entities/Project";

describe("Project", () => {
  it("should create a project with correct paths", () => {
    const project = createProject("/home/user/project");

    expect(project.rootPath).toBe("/home/user/project");
    expect(project.rulesPath).toBe("/home/user/project/rules");
    expect(project.skillsPath).toBe("/home/user/project/skills");
    expect(project.agentsPath).toBe("/home/user/project/agents");
    expect(project.commandsPath).toBe("/home/user/project/commands");
    expect(project.rules).toEqual([]);
    expect(project.skills).toEqual([]);
    expect(project.agents).toEqual([]);
  });
});
