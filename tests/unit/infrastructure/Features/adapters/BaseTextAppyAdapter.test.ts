import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { BaseTextApplyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextApplyAdapter";
import type { ApplyConfigTarget, ApplyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

class TestTextAdapter extends BaseTextApplyAdapter {
  readonly platformName = "opencode" as const;
  private readonly targetPath: string;

  constructor(targetPath: string) {
    super();
    this.targetPath = targetPath;
  }

  async resolveTarget(_projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    return {
      configPath: this.targetPath,
      scope: request?.targetScope ?? "user",
      surface: "commands",
    };
  }

  protected buildDesiredContent(target: ApplyConfigTarget): string {
    return `content:${target.scope}`;
  }
}

describe("BaseTextApplyAdapter", () => {
  let workspace: string;
  let targetPath: string;
  let adapter: TestTextAdapter;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "base-text-adapter-"));
    targetPath = resolve(workspace, "nested", "platform.txt");
    adapter = new TestTextAdapter(targetPath);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("writes config for success path and reports success message", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath: workspace,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    expect(result.message).toContain("Applied managed configuration");
    const content = await readFile(targetPath, "utf-8");
    expect(content).toContain("content:user");
  });

  it("reports unchanged when target content is already in desired state", async () => {
    await adapter.applyApplyIntegration({
      projectPath: workspace,
      targetScope: "project",
    });

    const second = await adapter.applyApplyIntegration({
      projectPath: workspace,
      targetScope: "project",
    });
    expect(second.status).toBe("unchanged");
    expect(second.message).toContain("already contains the required");
  });

  it("honors dry-run by skipping file write", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath: workspace,
      dryRun: true,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    await expect(readFile(targetPath, "utf-8")).rejects.toBeDefined();
  });
});
