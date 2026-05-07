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
  stdoutWrites: string[];
  stderrWrites: string[];
  restore: () => void;
} {
  const originalLog = console.log;
  const originalError = console.error;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const logs: string[] = [];
  const errors: string[] = [];
  const stdoutWrites: string[] = [];
  const stderrWrites: string[] = [];

  console.log = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    logs.push(message);
  };
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    errors.push(message);
  };
  process.stdout.write = ((chunk: string | Buffer) => {
    stdoutWrites.push(Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Buffer) => {
    stderrWrites.push(Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stderr.write;

  return {
    get logs() {
      const combined = [...logs, ...stdoutWrites, ...errors, ...stderrWrites];
      return combined.map(String);
    },
    errors,
    stdoutWrites,
    stderrWrites,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
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
