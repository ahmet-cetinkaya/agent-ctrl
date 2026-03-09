import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { CatalogOperationLogStore } from "@/infrastructure/features/catalog/caching/CatalogOperationLogStore";
import { mkdir, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import type { OperationLogEntry, OperationType, RegistryId } from "@/core/domain/shared/entities";

describe("CatalogOperationLogStore", () => {
  let store: CatalogOperationLogStore;
  let testDir: string;

  beforeEach(async () => {
    store = new CatalogOperationLogStore();
    testDir = resolve(tmpdir(), `operation-log-store-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe("append", () => {
    it("should append operation log entry to log file", async () => {
      const entry: OperationLogEntry = {
        operationId: "op-001",
        operationType: "sync" as OperationType,
        catalogKey: "skill:test-skill",
        status: "success",
        message: "Sync completed successfully",
        occurredAt: "2024-01-01T00:00:00Z",
      };

      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }

      // Verify file was created and contains the entry
      const logContent = await readFile(resolve(testDir, ".catalog", "operations.jsonl"), "utf-8");
      const logLines = logContent.trim().split("\n");
      expect(logLines).toHaveLength(1);
      expect(JSON.parse(logLines[0])).toEqual(entry);
    });

    it("should append multiple entries to the same file", async () => {
      const entry1: OperationLogEntry = {
        operationId: "op-001",
        operationType: "sync" as OperationType,
        catalogKey: "skill:skill1",
        status: "success",
        message: "First sync",
        occurredAt: "2024-01-01T00:00:00Z",
      };

      const entry2: OperationLogEntry = {
        operationId: "op-002",
        operationType: "update" as OperationType,
        catalogKey: "mcp:mcp1",
        status: "success",
        message: "Second sync",
        occurredAt: "2024-01-01T01:00:00Z",
      };

      await store.append(testDir, entry1);
      await store.append(testDir, entry2);

      const logContent = await readFile(resolve(testDir, ".catalog", "operations.jsonl"), "utf-8");
      const logLines = logContent.trim().split("\n");
      expect(logLines).toHaveLength(2);

      expect(JSON.parse(logLines[0])).toEqual(entry1);
      expect(JSON.parse(logLines[1])).toEqual(entry2);
    });

    it("should create log file directory if it does not exist", async () => {
      const entry: OperationLogEntry = {
        operationId: "op-001",
        operationType: "sync" as OperationType,
        catalogKey: "skill:test-skill",
        status: "success",
        message: "Sync completed",
        occurredAt: "2024-01-01T00:00:00Z",
      };

      // Don't create the .catalog directory beforehand
      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);

      // Verify file was created
      const logContent = await readFile(resolve(testDir, ".catalog", "operations.jsonl"), "utf-8");
      expect(logContent).toBeTruthy();
    });

    it("should return error on file system failure", async () => {
      const entry: OperationLogEntry = {
        operationId: "op-001",
        operationType: "sync" as OperationType,
        catalogKey: "skill:test-skill",
        status: "success",
        message: "Sync completed",
        occurredAt: "2024-01-01T00:00:00Z",
      };

      // Use an invalid path that should cause appendFile to fail
      const invalidPath = "/root/nonexistent/path/that/cannot/be/created";

      const result = await store.append(invalidPath, entry);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Failed to append catalog operation log");
      }
    });

    it("should handle entries with different operation types", async () => {
      const operations: OperationType[] = ["sync", "search", "activate", "deactivate", "update"];

      for (let i = 0; i < operations.length; i++) {
        const logEntry: OperationLogEntry = {
          operationId: `op-${i}`,
          operationType: operations[i],
          catalogKey: `skill:test-${operations[i]}`,
          status: "success",
          message: `Operation ${operations[i]} completed`,
          occurredAt: "2024-01-01T00:00:00Z",
        };

        const result = await store.append(testDir, logEntry);
        expect(result.success).toBe(true);
      }

      const logContent = await readFile(resolve(testDir, ".catalog", "operations.jsonl"), "utf-8");
      const logLines = logContent.trim().split("\n");
      expect(logLines).toHaveLength(5);

      const loggedOperations = logLines.map((line) => JSON.parse(line).operationType);
      expect(loggedOperations).toEqual(operations);
    });

    it("should handle entries with registryId", async () => {
      const entry: OperationLogEntry = {
        operationId: "op-001",
        operationType: "sync" as OperationType,
        registryId: "smithery" as RegistryId,
        catalogKey: "skill:test-skill",
        status: "success",
        message: "Sync completed",
        occurredAt: "2024-01-01T00:00:00Z",
      };

      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);

      const logContent = await readFile(resolve(testDir, ".catalog", "operations.jsonl"), "utf-8");
      const parsedEntry = JSON.parse(logContent.trim());
      expect(parsedEntry.registryId).toBe("smithery");
    });
  });
});
