import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

class TestTextAdapter extends BaseTextAppyAdapter {
  readonly platformName = "opencode" as const;
  private readonly targetPath: string;

  constructor(targetPath: string) {
    super();
    this.targetPath = targetPath;
  }

  async resolveTarget(_projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return {
      configPath: this.targetPath,
      scope: request?.targetScope ?? "user",
      surface: "commands",
    };
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return `content:${target.scope}`;
  }
}

describe("BaseTextAppyAdapter", () => {
  let workspace: string;
  let targetPath: string;
  let adapter: TestTextAdapter;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "base-text-adapter-"));
    targetPath = resolve(workspace, "nested", "appy.txt");
    adapter = new TestTextAdapter(targetPath);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("writes config for success path and reports success message", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath: workspace,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    expect(result.message).toContain("Applied appy integration");
    const content = await readFile(targetPath, "utf-8");
    expect(content).toContain("content:user");
  });

  it("reports unchanged when target content is already in desired state", async () => {
    await adapter.applyAppyIntegration({
      projectPath: workspace,
      targetScope: "project",
    });

    const second = await adapter.applyAppyIntegration({
      projectPath: workspace,
      targetScope: "project",
    });
    expect(second.status).toBe("unchanged");
    expect(second.message).toContain("already contains the required");
  });

  it("honors dry-run by skipping file write", async () => {
    const result = await adapter.applyAppyIntegration({
      projectPath: workspace,
      dryRun: true,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    await expect(readFile(targetPath, "utf-8")).rejects.toBeDefined();
  });
});
