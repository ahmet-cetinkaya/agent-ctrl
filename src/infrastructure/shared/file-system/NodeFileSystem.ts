import { mkdir, writeFile, access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { IFileSystem, FileSystemEntry } from "../../../../core/domain/shared/interfaces/IFileSystem";

export class NodeFileSystem implements IFileSystem {
  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await mkdir(path, options);
  }

  async writeFile(path: string, content: string, encoding?: string): Promise<void> {
    await writeFile(path, content, encoding as BufferEncoding);
  }

  async access(path: string): Promise<void> {
    await access(path);
  }

  async readdir(path: string): Promise<FileSystemEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  resolve(...paths: string[]): string {
    return resolve(...paths);
  }
}
