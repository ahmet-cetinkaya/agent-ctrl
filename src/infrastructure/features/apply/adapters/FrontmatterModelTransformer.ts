import { isMap, parseDocument } from "yaml";
import type { ArtifactKind } from "@/core/domain/shared/modelFrontmatter";
import { resolveModelFrontmatter } from "@/core/domain/shared/modelFrontmatter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/;
const MODEL_KEY = "model";
const MODELS_KEY = "models";
const PROVIDER_KEY = "provider";

export interface FrontmatterModelTransformResult {
  content: string;
  warnings: string[];
}

/**
 * Resolves agent-ctrl's `model`/`models` frontmatter configuration against the
 * target platform's capability, rewriting the source before platform rendering.
 *
 * Runs BEFORE renderers (they preserve unknown frontmatter verbatim), so no
 * renderer signature changes are needed. Source without `model`/`models` is
 * returned byte-identical (spec SC-003).
 */
export function applyModelFrontmatter(
  source: string,
  platform: SupportedApplyPlatform,
  artifactKind: ArtifactKind
): FrontmatterModelTransformResult {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { content: source, warnings: [] };
  }

  const [, frontmatterText, rest = ""] = match;
  const doc = parseDocument(frontmatterText);
  if (doc.errors.length > 0) {
    return {
      content: source,
      warnings: [`model: skipped — frontmatter is not valid YAML and was left untouched (${doc.errors[0].message}).`],
    };
  }

  const hasModelField = doc.has(MODEL_KEY);
  const rawModels = doc.get(MODELS_KEY);
  const hasModelsField = rawModels !== undefined && rawModels !== null;
  if (!hasModelField && !hasModelsField) {
    return { content: source, warnings: [] };
  }

  const warnings: string[] = [];
  const rawModel = doc.get(MODEL_KEY);
  const modelsRecord = isMap(rawModels)
    ? (Object.fromEntries(
        rawModels.items.map((pair) => [
          String((pair.key as { value?: unknown })?.value ?? pair.key),
          (pair.value as { value?: unknown })?.value ?? pair.value,
        ])
      ) as Record<string, unknown>)
    : undefined;
  const resolution = resolveModelFrontmatter({
    model: rawModel === null || rawModel === undefined ? undefined : rawModel,
    models: modelsRecord ?? (isPlainRecord(rawModels) ? rawModels : undefined),
    platform,
    artifactKind,
  });
  warnings.push(...resolution.warnings);

  if (resolution.action === "set") {
    doc.set(MODEL_KEY, resolution.value);
    if (resolution.provider !== undefined) {
      if (doc.has(PROVIDER_KEY) && doc.get(PROVIDER_KEY) !== resolution.provider) {
        warnings.push(`provider: overwritten by resolved model value (was set manually with a different value).`);
      }
      doc.set(PROVIDER_KEY, resolution.provider);
    }
  } else {
    doc.delete(MODEL_KEY);
  }
  doc.delete(MODELS_KEY);

  const contents = doc.contents;
  const isEmptyDocument =
    contents === null ||
    (contents &&
      typeof contents === "object" &&
      "items" in contents &&
      (contents as { items: unknown[] }).items.length === 0);
  if (isEmptyDocument) {
    return { content: rest.replace(/^\r?\n/, "").replace(/^\r?\n/, ""), warnings };
  }

  return {
    content: `---\n${doc.toString().trimEnd()}\n---${rest}`,
    warnings,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
