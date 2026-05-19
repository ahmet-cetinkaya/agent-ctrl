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
