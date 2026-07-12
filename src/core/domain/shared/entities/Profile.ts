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

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function createProfile(
  name: string,
  path: string,
  configRoot: string,
  artifactPaths: ProfileArtifactPaths
): Profile {
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(`Profile name '${name}' is invalid. Must match pattern: ${PROFILE_NAME_PATTERN.source}`);
  }

  return {
    name,
    path,
    configRoot,
    artifactPaths,
  };
}
