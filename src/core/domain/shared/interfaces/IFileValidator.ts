import type { Result } from "../value-objects/Result";

export interface IFileValidator {
  /**
   * Check if file has valid markdown extension (.md or .markdown)
   */
  hasExtension(filePath: string, extensions: string[]): boolean;

  /**
   * Check if file is readable
   */
  isReadable(filePath: string): Promise<Result<boolean, Error>>;

  /**
   * Check if file exists
   */
  exists(filePath: string): Promise<Result<boolean, Error>>;

  /**
   * Validate markdown file (.md/.markdown extension and readable)
   */
  validateMarkdownFile(filePath: string): Promise<Result<boolean, Error>>;

  /**
   * Validate skill directory (contains readable SKILL.md)
   */
  validateSkillDirectory(dirPath: string): Promise<Result<boolean, Error>>;
}
