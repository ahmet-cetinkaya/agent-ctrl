import { describe, it, expect } from "bun:test";
import { validateUserPath, handleDirectoryAccess, analyzeQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

describe("resultHandler", () => {
  describe("validateUserPath", () => {
    it("returns error for null bytes in path", () => {
      expect(validateUserPath("test\0file", "--path")).toBe("Invalid --path: path contains null bytes");
    });

    it("returns error for path traversal patterns with forward slashes", () => {
      expect(validateUserPath("../../../etc/passwd", "--path")).toBe("Invalid --path: path traversal detected");
      expect(validateUserPath("subdir/../../etc", "--path")).toBe("Invalid --path: path traversal detected");
      expect(validateUserPath("./../hidden", "--path")).toBe("Invalid --path: path traversal detected");
    });

    it("returns error for path traversal patterns with backslashes", () => {
      expect(validateUserPath("subdir\\..\\..\\etc", "--path")).toBe("Invalid --path: path traversal detected");
      expect(validateUserPath("..\\..\\system", "--path")).toBe("Invalid --path: path traversal detected");
    });

    it("returns undefined for valid relative paths", () => {
      expect(validateUserPath("./relative/path", "--path")).toBeUndefined();
      expect(validateUserPath("subdir/nested/path", "--path")).toBeUndefined();
      // Note: ../ anywhere in the path is detected as traversal (strict security)
      expect(validateUserPath("../allowed/sibling", "--path")).toBe("Invalid --path: path traversal detected");
    });

    it("returns undefined for valid absolute paths", () => {
      expect(validateUserPath("/home/user/config", "--path")).toBeUndefined();
      expect(validateUserPath("/usr/local/bin", "--path")).toBeUndefined();
    });

    it("warns about absolute paths that are not /home/ or /users/", () => {
      // This test just verifies the path is valid - the warning goes to console.warn
      expect(validateUserPath("/etc/config", "--path")).toBeUndefined();
      expect(validateUserPath("/var/data", "--path")).toBeUndefined();
    });
  });

  describe("analyzeQueryResult", () => {
    it("returns success for successful result", () => {
      const result = ok({ data: "test" });
      const analysis = analyzeQueryResult(result);
      expect(analysis).toEqual({ success: true });
    });

    it("returns UserError details for UserError", () => {
      const userError = new UserError("User did something wrong", ERROR_IDS.CLI_INVALID_ARGUMENT);
      const result = err(userError);
      const analysis = analyzeQueryResult(result);
      expect(analysis).toEqual({
        success: false,
        exitCode: 1, // UserError always has exitCode 1
        message: "User did something wrong",
        errorId: "CLI_INVALID_ARG",
      });
    });

    it("returns SystemError details for unexpected errors", () => {
      const systemError = new SystemError("System failure", ERROR_IDS.SYSTEM_ERROR);
      const result = err(systemError);
      const analysis = analyzeQueryResult(result);
      expect(analysis.success).toBe(false);
      expect(analysis.exitCode).toBe(2);
      expect(analysis.message).toBe("Unexpected error: SystemError: System failure");
      expect(analysis.errorId).toBe("SYS_ERROR");
    });

    it("returns error details for generic Error", () => {
      const genericError = new Error("Generic error");
      const result = err(genericError);
      const analysis = analyzeQueryResult(result);
      expect(analysis).toEqual({
        success: false,
        exitCode: 2,
        message: "Unexpected error: Error: Generic error",
        errorId: ERROR_IDS.SYSTEM_ERROR,
      });
    });

    it("returns error details for string errors", () => {
      const result = err("String error");
      const analysis = analyzeQueryResult(result);
      expect(analysis).toEqual({
        success: false,
        exitCode: 2,
        message: "Unexpected error: String error",
        errorId: ERROR_IDS.SYSTEM_ERROR,
      });
    });

    it("verifies error IDs are propagated from SystemError", () => {
      const systemError = new SystemError("File write failed", ERROR_IDS.FILE_WRITE_FAILED);
      expect(systemError.errorId).toBe("E_FILE_WRITE");

      const result = err(systemError);
      const analysis = analyzeQueryResult(result);
      expect(analysis.errorId).toBe("E_FILE_WRITE");
    });

    it("verifies error IDs are propagated from UserError", () => {
      const userError = new UserError("Invalid argument", ERROR_IDS.CLI_INVALID_ARGUMENT);
      expect(userError.errorId).toBe("CLI_INVALID_ARG");

      const result = err(userError);
      const analysis = analyzeQueryResult(result);
      expect(analysis.errorId).toBe("CLI_INVALID_ARG");
    });

    it("allows optional errorId on errors", () => {
      const systemError = new SystemError("Generic error");
      expect(systemError.errorId).toBeUndefined();

      const userError = new UserError("Generic user error");
      expect(userError.errorId).toBeUndefined();
    });
  });
});
