import { CatalogEnvFileLoader } from "./CatalogEnvFileLoader";

export class CatalogCredentialBootstrap {
  constructor(private readonly envLoader = new CatalogEnvFileLoader()) {}

  async applySkillCredentials(configRoot: string, explicitApiKey?: string): Promise<string | undefined> {
    const loaded = await this.envLoader.load(configRoot);
    if (!loaded.success) {
      throw loaded.error;
    }

    const resolved =
      explicitApiKey ??
      loaded.data.values.SKILLSMP_API_KEY ??
      loaded.data.values.SKILLSMP_TOKEN ??
      process.env.SKILLSMP_API_KEY ??
      process.env.SKILLSMP_TOKEN;

    if (resolved) {
      process.env.SKILLSMP_API_KEY = resolved;
    }

    return resolved;
  }

  async applySmitheryCredentials(configRoot: string, explicitApiKey?: string): Promise<string | undefined> {
    const loaded = await this.envLoader.load(configRoot);
    if (!loaded.success) {
      throw loaded.error;
    }

    const resolved =
      explicitApiKey ??
      loaded.data.values.SMITHERY_API_KEY ??
      loaded.data.values.SMITHERY_TOKEN ??
      process.env.SMITHERY_API_KEY ??
      process.env.SMITHERY_TOKEN;

    if (resolved) {
      process.env.SMITHERY_API_KEY = resolved;
    }

    return resolved;
  }
}
