import { access, constants, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import type { IFileValidator } from "@/core/domain/shared/interfaces/IFileValidator";
import type { Result } from "@/core/domain/shared/value-objects/Result";
import { MARKDOWN_EXTENSIONS } from "@/core/domain/shared/value-objects/FileExtensions";
import { ok, err } from "@/core/domain/shared/value-objects/Result";

export class FileValidator implements IFileValidator {
  hasExtension(filePath: string, extensions: string[]): boolean {
    const ext = extname(filePath).toLowerCase();
    return extensions.includes(ext);
  }

  async isReadable(filePath: string): Promise<Result<boolean, Error>> {
    try {
      await access(filePath, constants.R_OK);
      return ok(true);
    } catch (error) {
      return err(new Error(`File is not readable: ${filePath}`));
    }
  }

  async exists(filePath: string): Promise<Result<boolean, Error>> {
    try {
      await stat(filePath);
      return ok(true);
    } catch (error) {
      return err(new Error(`File does not exist: ${filePath}`));
    }
  }

  async validateMarkdownFile(filePath: string): Promise<Result<boolean, Error>> {
    const hasValidExt = this.hasExtension(filePath, [...MARKDOWN_EXTENSIONS]);
    if (!hasValidExt) {
      return err(new Error(`Invalid extension: ${filePath}`));
    }

    const existsResult = await this.exists(filePath);
    if (!existsResult.success) {
      return existsResult;
    }

    const readableResult = await this.isReadable(filePath);
    if (!readableResult.success) {
      return readableResult;
    }

    return ok(true);
  }

  async validateSkillDirectory(dirPath: string): Promise<Result<boolean, Error>> {
    const existsResult = await this.exists(dirPath);
    if (!existsResult.success) {
      return existsResult;
    }

    try {
      const stats = await stat(dirPath);
      if (!stats.isDirectory()) {
        return err(new Error(`Path is not a directory: ${dirPath}`));
      }
    } catch (error) {
      return err(new Error(`Cannot stat directory: ${dirPath}`));
    }

    const skillMdPath = join(dirPath, "SKILL.md");
    const skillMdResult = await this.isReadable(skillMdPath);
    if (!skillMdResult.success) {
      return err(new Error(`SKILL.md not found or not readable in: ${dirPath}`));
    }

    return ok(true);
  }
}
