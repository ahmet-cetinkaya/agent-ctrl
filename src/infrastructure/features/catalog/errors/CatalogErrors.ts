/**
 * Creates a standardized error message for missing API keys.
 */
export function createMissingApiKeyError(registryName: string, envVarName: string): Error {
  return new Error(
    `${registryName} API key is missing. Configure ${envVarName} in .agent-ctrl/.env or pass --api-key.`
  );
}
