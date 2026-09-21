import { getPlatformDisplayName, isSupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { getModelCapability } from "./ModelCapabilityMatrix";
import type { ModelFrontmatterInput, ModelResolution } from "./types";

const OVERRIDE_KEY = "models";

export function resolveModelFrontmatter(input: ModelFrontmatterInput): ModelResolution {
  const capability = getModelCapability(input.platform, input.artifactKind);
  const warnings: string[] = [];

  validateModelsMap(input, warnings);

  const overrideValue = readOverrideForPlatform(input);
  const canonicalModel = typeof input.model === "string" ? input.model : undefined;
  const canonicalPresent = canonicalModel !== undefined && canonicalModel.trim().length > 0;

  if (overrideValue !== undefined) {
    if (capability.support === "drop") {
      warnings.push(
        `models.${input.platform}: override ignored — ${getPlatformDisplayName(input.platform)} does not support a model field on this surface.`
      );
      return { action: "drop", warnings };
    }
    // Explicit override wins and bypasses transformation (user's exact value).
    return { action: "set", value: overrideValue, warnings };
  }

  if (!canonicalPresent) {
    if (input.model === undefined) {
      return { action: "absent", warnings };
    }
    warnings.push(`model: value must be a non-empty string — ignored for ${getPlatformDisplayName(input.platform)}.`);
    return { action: "drop", warnings };
  }

  if (capability.support === "drop") {
    warnings.push(
      `model: dropped — ${getPlatformDisplayName(input.platform)} does not support a model field on this surface.`
    );
    return { action: "drop", warnings };
  }

  if (capability.requiresOverride) {
    warnings.push(
      `model: dropped — ${getPlatformDisplayName(input.platform)} accepts a constrained model vocabulary on this surface; override via \`${OVERRIDE_KEY}.${input.platform}\`.`
    );
    return { action: "drop", warnings };
  }

  const resolution = applyTransform(canonicalModel as string, capability.transform);
  return { ...resolution, warnings: [...warnings, ...resolution.warnings] };
}

function applyTransform(value: string, transform: "passthrough" | "prefix-strip" | "split"): ModelResolution {
  if (transform === "prefix-strip") {
    const separator = value.indexOf("/");
    return { action: "set", value: separator === -1 ? value : value.slice(separator + 1), warnings: [] };
  }

  if (transform === "split") {
    const separator = value.indexOf("/");
    if (separator === -1) {
      return { action: "set", value, warnings: [] };
    }
    return {
      action: "set",
      value: value.slice(separator + 1),
      provider: value.slice(0, separator),
      warnings: [],
    };
  }

  return { action: "set", value, warnings: [] };
}

function validateModelsMap(input: ModelFrontmatterInput, warnings: string[]): void {
  if (input.models === undefined || input.models === null) {
    return;
  }
  if (typeof input.models !== "object" || Array.isArray(input.models)) {
    warnings.push(`models: must be a map of platform name to model value — ignored.`);
    return;
  }

  for (const [key, value] of Object.entries(input.models as Record<string, unknown>)) {
    if (!isSupportedApplyPlatform(key)) {
      warnings.push(`models.${key}: unknown platform name — ignored. Use a supported apply platform.`);
      continue;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      warnings.push(`models.${key}: value must be a non-empty string — ignored.`);
    }
  }
}

function readOverrideForPlatform(input: ModelFrontmatterInput): string | undefined {
  if (input.models === undefined || input.models === null) {
    return undefined;
  }
  if (typeof input.models !== "object" || Array.isArray(input.models)) {
    return undefined;
  }

  const value = (input.models as Record<string, unknown>)[input.platform];
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  return value;
}
