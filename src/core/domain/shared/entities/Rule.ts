import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";
import type { ArtifactBase } from "@/core/domain/shared/types/Artifact";

export interface Rule extends ArtifactBase {
  type: ArtifactType.RULE;
  filename: string;
}

export function createRule(id: string, filename: string, path: string): Rule {
  return {
    id,
    filename,
    path,
    type: ArtifactType.RULE,
  };
}
