export class McpServerEnvComposer {
  compose(baseEnv: Record<string, string>, serverEnv?: Record<string, string>): Record<string, string> {
    return {
      ...baseEnv,
      ...(serverEnv ?? {}),
    };
  }
}
