import type { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";

export interface ArtifactBase {
  id: string;
  path: string;
  type: ArtifactType;
}

export type Artifact = Rule | Skill | Agent;

// Forward declarations - actual entities will import this
declare interface Rule extends ArtifactBase {
  type: ArtifactType.RULE;
  filename: string;
}

declare interface Skill extends ArtifactBase {
  type: ArtifactType.SKILL;
  directoryName: string;
}

declare interface Agent extends ArtifactBase {
  type: ArtifactType.AGENT;
  filename: string;
}
