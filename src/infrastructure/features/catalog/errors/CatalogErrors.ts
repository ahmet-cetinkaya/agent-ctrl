/**
 * Creates a standardized error message for missing API keys.
 * Validates inputs to ensure consistent user experience across different registries.
 */
export function createMissingApiKeyError(registryName: string, envVarName: string): Error {
  if (!registryName.trim()) {
    throw new Error("registryName cannot be empty");
  }
  if (!envVarName.trim() || !/^[A-Z_][A-Z0-9_]*$/.test(envVarName)) {
    throw new Error("envVarName must be a valid environment variable name (uppercase letters, numbers, underscores)");
  }
  return new Error(
    `${registryName} API key is missing. Configure ${envVarName} in .agent-ctrl/.env or pass --api-key.`
  );
}

/**
 * Creates a standardized error for when a skill reference cannot be found.
 * This is a domain-level error that wraps various underlying causes (404, invalid ID, etc.)
 */
export function createSkillNotFoundError(skillRef: string, cause?: string): Error {
  const baseMessage = `Skill "${skillRef}" could not be found.`;
  const hint = `Try: agent-ctrl skill search <query> to find available skills.`;
  const causeSuffix = cause ? `\nCause: ${cause}` : "";
  return new Error(`${baseMessage}${causeSuffix}\n\n${hint}`);
}

/**
 * Creates a standardized error for when the SkillsMP service is blocking requests.
 * This handles 403 errors, Cloudflare blocks, etc.
 */
export function createSkillAccessBlockedError(skillRef: string): Error {
  return new Error(
    `The SkillsMP service is blocking requests for "${skillRef}".\n\n` +
    `Hint: The service may be restricting access from this environment.\n` +
    `Try: agent-ctrl skill search <query> to find available skills locally.`
  );
}

/**
 * Creates a standardized error for when a skill's repository cannot be accessed.
 * This wraps GitHub API failures into a domain-level error.
 */
export function createSkillRepositoryNotAccessibleError(skillRef: string, repositoryUrl: string): Error {
  return new Error(
    `The repository for "${skillRef}" could not be accessed.\n\n` +
    `Expected repository: ${repositoryUrl}\n\n` +
    `Hint: Verify the repository exists and is publicly accessible, or search ` +
    `for an alternative skill using: agent-ctrl skill search <query>`
  );
}
