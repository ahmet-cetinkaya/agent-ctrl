/**
 * Canonical artifact directory names scaffolded into every profile.
 * Single source of truth — consumers (CreateProfileCommand, ProfileScanner) must
 * import these instead of re-declaring the list, so the set cannot drift.
 */
export const PROFILE_ARTIFACT_DIRECTORIES = ["rules", "skills", "agents", "commands", "mcps"] as const;

/** Placeholder file written into each scaffolded artifact directory. */
export const PROFILE_GITKEEP_FILE = ".gitkeep";

export interface ProfileArtifactPaths {
  rules: string | null;
  skills: string | null;
  agents: string | null;
  commands: string | null;
  mcps: string | null;
}

export interface Profile {
  name: string;
  path: string;
  configRoot: string;
  artifactPaths: ProfileArtifactPaths;
}

/**
 * Display metadata for a profile, sourced from an optional `profile.yaml`
 * at the profile directory root. The first tag is treated as the category.
 * All fields have fallbacks so profiles without metadata still render.
 */
export interface ProfileMetadata {
  displayName: string;
  description: string;
  tags: string[];
  category: string;
}

export const UNCATEGORIZED_CATEGORY = "Uncategorized";

/**
 * Centralizes the "is this the fallback category" check so callers never
 * compare against `UNCATEGORIZED_CATEGORY` by hand and risk drifting from it.
 */
export function isUncategorizedCategory(category: string): boolean {
  return category === UNCATEGORIZED_CATEGORY;
}

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_PATTERN.test(name);
}

export function createProfile(
  name: string,
  path: string,
  configRoot: string,
  artifactPaths: ProfileArtifactPaths
): Profile {
  if (!isValidProfileName(name)) {
    throw new Error(`Profile name '${name}' is invalid. Must match pattern: ${PROFILE_NAME_PATTERN.source}`);
  }

  return {
    name,
    path,
    configRoot,
    artifactPaths,
  };
}
