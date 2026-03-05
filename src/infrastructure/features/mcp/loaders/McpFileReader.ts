import { readFile } from "node:fs/promises";

export class McpFileReader {
  async readJson(filePath: string): Promise<unknown> {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  }
}
