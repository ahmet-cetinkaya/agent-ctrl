import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CatalogItem } from "@/core/domain/shared/entities";

export class SkillInstallMaterializer {
  async install(configRoot: string, item: CatalogItem): Promise<{ localPath: string }> {
    const skillDir = resolve(configRoot, "skills", this.sanitize(item.sourceItemId));
    await mkdir(skillDir, { recursive: true });

    const markdown =
      item.metadata?.installation?.skillMarkdown ??
      [
        `# ${item.displayName}`,
        "",
        item.description ?? "Imported from SkillsMP.",
        "",
        `Source: ${item.sourceUrl ?? `${item.registryId}:${item.sourceItemId}`}`,
      ].join("\n");

    await writeFile(resolve(skillDir, "SKILL.md"), markdown, "utf-8");

    for (const [relativePath, content] of Object.entries(item.metadata?.installation?.files ?? {})) {
      const targetPath = resolve(skillDir, relativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content, "utf-8");
    }

    await writeFile(
      resolve(skillDir, ".agent-ctrl-source.json"),
      JSON.stringify(
        {
          source: `${item.registryId}:${item.sourceItemId}`,
          version: item.sourceVersion,
          sourceUrl: item.sourceUrl,
          installedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );

    return { localPath: skillDir };
  }

  async remove(localPath: string): Promise<void> {
    await rm(localPath, { recursive: true, force: true });
  }

  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  }
}
