import { describe, it, expect } from "bun:test";
import { createProject } from "@/core/domain/shared/entities/Project";

describe("Project", () => {
  it("should create a project with correct paths", () => {
    const project = createProject("/tmp/project");

    expect(project.rootPath).toBe("/tmp/project");
    expect(project.rulesPath).toBe("/tmp/project/rules");
    expect(project.skillsPath).toBe("/tmp/project/skills");
    expect(project.agentsPath).toBe("/tmp/project/agents");
    expect(project.commandsPath).toBe("/tmp/project/commands");
    expect(project.rules).toEqual([]);
    expect(project.skills).toEqual([]);
    expect(project.agents).toEqual([]);
  });
});
