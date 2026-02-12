import { ArtifactType } from "../value-objects/ArtifactType";
import type { ArtifactBase } from "../types/Artifact";

export interface Agent extends ArtifactBase {
  type: ArtifactType.AGENT;
  filename: string;
}

export function createAgent(id: string, filename: string, path: string): Agent {
  return {
    id,
    filename,
    path,
    type: ArtifactType.AGENT,
  };
}
