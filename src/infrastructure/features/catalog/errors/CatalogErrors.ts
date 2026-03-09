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
