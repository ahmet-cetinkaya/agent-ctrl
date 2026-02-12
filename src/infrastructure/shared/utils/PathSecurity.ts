import { resolve, normalize, isAbsolute } from "node:path";

export class PathSecurity {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
  }

  /**
   * Validate path is within project root (T076 - Path traversal protection)
   */
  isWithinProject(targetPath: string): boolean {
    const resolvedPath = resolve(this.projectRoot, targetPath);
    const normalizedProject = normalize(this.projectRoot);
    const normalizedTarget = normalize(resolvedPath);

    return normalizedTarget.startsWith(normalizedProject) || normalizedTarget === normalizedProject;
  }

  /**
   * Sanitize path to prevent directory traversal attacks
   */
  sanitizePath(inputPath: string): string {
    let sanitized = inputPath.replace(/\0/g, "");

    sanitized = sanitized.replace(/\\/g, "/");

    // Normalize the path by resolving parent directory references
    const parts = sanitized.split("/").filter((p) => p.length > 0);
    const normalizedParts: string[] = [];

    for (const part of parts) {
      if (part === "..") {
        // If we go above root, it's a traversal attempt
        if (normalizedParts.length === 0) {
          throw new Error("Path traversal attempt detected");
        }
        normalizedParts.pop();
      } else if (part !== ".") {
        normalizedParts.push(part);
      }
    }

    return normalizedParts.join("/");
  }

  /**
   * Validate path doesn't contain special characters that could cause issues (T077)
   */
  hasSpecialCharacters(path: string): boolean {
    const problematicChars = /[<>:"|?*\x00-\x1f]/;
    return problematicChars.test(path);
  }

  /**
   * Safe path resolution with validation
   */
  resolveSafe(inputPath: string): {
    safe: boolean;
    path: string;
    error?: string;
  } {
    if (this.hasSpecialCharacters(inputPath)) {
      return {
        safe: false,
        path: "",
        error: "Path contains special characters that are not allowed",
      };
    }

    // Handle absolute paths - check directly if within project
    if (isAbsolute(inputPath)) {
      if (!this.isWithinProject(inputPath)) {
        return {
          safe: false,
          path: "",
          error: "Path traversal attempt detected",
        };
      }
      return { safe: true, path: normalize(inputPath) };
    }

    const sanitized = this.sanitizePath(inputPath);

    const resolved = resolve(this.projectRoot, sanitized);

    if (!this.isWithinProject(resolved)) {
      return {
        safe: false,
        path: "",
        error: "Path traversal attempt detected",
      };
    }

    return { safe: true, path: resolved };
  }
}
