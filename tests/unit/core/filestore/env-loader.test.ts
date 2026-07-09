import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "@/core/filestore/env-loader.js";

describe("env-loader", () => {
  const testDir = "/tmp/test-env-loader";

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("loads variables from project .agent-ctrl/.env", async () => {
    const envDir = path.join(testDir, ".agent-ctrl");
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(path.join(envDir, ".env"), "API_KEY=secret123\nENDPOINT=https://api.example.com\n", "utf-8");

    const result = await loadEnvFile(testDir);

    expect(result.exists).toBe(true);
    expect(result.variables).toEqual({
      API_KEY: "secret123",
      ENDPOINT: "https://api.example.com",
    });
  });

  it("falls back to user ~/.agent-ctrl/.env when project file is missing", async () => {
    const fakeHome = path.join(testDir, "home");
    const userEnvDir = path.join(fakeHome, ".agent-ctrl");
    fs.mkdirSync(userEnvDir, { recursive: true });
    fs.writeFileSync(path.join(userEnvDir, ".env"), "TOKEN=user-token\n", "utf-8");

    const result = await loadEnvFile(testDir, { userHomePath: fakeHome });

    expect(result.exists).toBe(true);
    expect(result.variables).toEqual({ TOKEN: "user-token" });
  });

  it("prefers project .env over user fallback", async () => {
    const projectEnvDir = path.join(testDir, ".agent-ctrl");
    const fakeHome = path.join(testDir, "home");
    const userEnvDir = path.join(fakeHome, ".agent-ctrl");
    fs.mkdirSync(projectEnvDir, { recursive: true });
    fs.mkdirSync(userEnvDir, { recursive: true });
    fs.writeFileSync(path.join(projectEnvDir, ".env"), "SOURCE=project\n", "utf-8");
    fs.writeFileSync(path.join(userEnvDir, ".env"), "SOURCE=user\n", "utf-8");

    const result = await loadEnvFile(testDir, { userHomePath: fakeHome });

    expect(result.exists).toBe(true);
    expect(result.variables).toEqual({ SOURCE: "project" });
  });

  it("ignores blank lines, comments, and malformed entries", async () => {
    const envDir = path.join(testDir, ".agent-ctrl");
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(
      path.join(envDir, ".env"),
      ["# comment", "", "VALID=value", "NOT_AN_ASSIGNMENT", "ALSO_VALID=two words"].join("\n"),
      "utf-8"
    );

    const result = await loadEnvFile(testDir);

    expect(result.exists).toBe(true);
    expect(result.variables).toEqual({
      VALID: "value",
      ALSO_VALID: "two words",
    });
  });

  it("removes matching surrounding quotes from values", async () => {
    const envDir = path.join(testDir, ".agent-ctrl");
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(path.join(envDir, ".env"), "DOUBLE=\"quoted value\"\nSINGLE='another value'\n", "utf-8");

    const result = await loadEnvFile(testDir);

    expect(result.exists).toBe(true);
    expect(result.variables).toEqual({
      DOUBLE: "quoted value",
      SINGLE: "another value",
    });
  });

  it("returns empty result when no env file exists", async () => {
    const fakeHome = path.join(testDir, "home");

    const result = await loadEnvFile(testDir, { userHomePath: fakeHome });

    expect(result.exists).toBe(false);
    expect(result.variables).toEqual({});
  });
});
