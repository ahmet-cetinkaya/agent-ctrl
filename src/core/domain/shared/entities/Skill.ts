import { ArtifactType } from "../value-objects/ArtifactType";
import type { ArtifactBase } from "../types/Artifact";

export interface Skill extends ArtifactBase {
  type: ArtifactType.SKILL;
  directoryName: string;
}

export function createSkill(id: string, directoryName: string, path: string): Skill {
  return {
    id,
    directoryName,
    path,
    type: ArtifactType.SKILL,
  };
}
