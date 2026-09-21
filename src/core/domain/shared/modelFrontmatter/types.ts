import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export type ModelTransform = "passthrough" | "prefix-strip" | "split";

export type ArtifactKind = "command" | "agent" | "skill";

export interface ModelCapability {
  support: "set" | "drop";
  transform: ModelTransform;
  requiresOverride: boolean;
}

export type ModelCapabilityByKind = {
  command: ModelCapability;
  agent: ModelCapability;
  skill: ModelCapability;
};

export type ModelCapabilityMatrixTable = Record<SupportedApplyPlatform, ModelCapabilityByKind>;

export interface ModelResolution {
  action: "absent" | "set" | "drop";
  value?: string;
  provider?: string;
  warnings: string[];
}

export interface ModelFrontmatterInput {
  model?: unknown;
  models?: unknown;
  platform: SupportedApplyPlatform;
  artifactKind: ArtifactKind;
}
