import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export async function createTempConfigRoot(prefix: string): Promise<{ baseDir: string; configRoot: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), prefix));
  const configRoot = resolve(baseDir, ".agent-ctrl");
  await mkdir(resolve(configRoot, "skills"), { recursive: true });
  await mkdir(resolve(configRoot, "mcps"), { recursive: true });
  return { baseDir, configRoot };
}

export async function cleanupTempDir(baseDir: string): Promise<void> {
  await rm(baseDir, { recursive: true, force: true });
}

export type MockRouteHandler = (url: URL, init?: RequestInit) => Promise<Response> | Response;

export function installMockFetch(routes: Array<{ match: (url: URL) => boolean; handler: MockRouteHandler }>): {
  restore: () => void;
  calls: string[];
} {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: string | URL | { url: string }, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.toString());

    const route = routes.find((entry) => entry.match(url));
    if (!route) {
      throw new Error(`Unexpected fetch for ${url.toString()}`);
    }
    return route.handler(url, init);
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    calls,
  };
}

export function captureConsole(): {
  logs: string[];
  errors: string[];
  restore: () => void;
} {
  const originalLog = console.log;
  const originalError = console.error;
  const logs: string[] = [];
  const errors: string[] = [];

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

export function mockProcessExit(): { restore: () => void } {
  const originalExit = process.exit;
  process.exit = ((code?: number) => {
    throw new Error(`EXIT:${code ?? 0}`);
  }) as typeof process.exit;

  return {
    restore: () => {
      process.exit = originalExit;
    },
  };
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf-8"));
}

export async function seedSkill(configRoot: string, id: string): Promise<void> {
  const skillDir = resolve(configRoot, "skills", id);
  await mkdir(skillDir, { recursive: true });
  await writeFile(resolve(skillDir, "SKILL.md"), `# ${id}\n`, "utf-8");
}
