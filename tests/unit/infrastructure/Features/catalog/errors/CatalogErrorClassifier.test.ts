import { describe, it, expect } from "bun:test";
import {
  classifyCatalogError,
  extractRetryAfter,
  createRetryableClassification,
  createFatalClassification,
  isRetryable,
} from "@/infrastructure/features/catalog/errors/CatalogErrorClassifier";

describe("CatalogErrorClassifier", () => {
  describe("classifyCatalogError", () => {
    it("classifies 429 rate limit errors as retryable", () => {
      const error = new Error("429 rate limit exceeded");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Rate limited by API");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(60);
      }
    });

    it("classifies 401 unauthorized as fatal", () => {
      const error = new Error("401 unauthorized");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Authentication failed");
    });

    it("classifies 403 forbidden as fatal", () => {
      const error = new Error("403 forbidden");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Authorization failed");
    });

    it("classifies AbortError timeouts as retryable", () => {
      const error = new Error("Request timed out");
      Object.defineProperty(error, "name", { value: "AbortError" });
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Request timeout");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(5);
      }
    });

    it("classifies network errors (ECONNREFUSED) as retryable", () => {
      const error = new Error("ECONNREFUSED connection refused");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Network error");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(10);
      }
    });

    it("classifies 500 server errors as retryable", () => {
      const error = new Error("500 internal server error");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Server error");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(30);
      }
    });

    it("classifies 502 bad gateway as retryable", () => {
      const error = new Error("502 bad gateway");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Server error");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(30);
      }
    });

    it("classifies 503 service unavailable as retryable", () => {
      const error = new Error("503 service unavailable");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Server error");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(30);
      }
    });

    it("classifies 504 gateway timeout as retryable", () => {
      const error = new Error("504 gateway timeout");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      expect(result.reason).toBe("Server error");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(30);
      }
    });

    it("classifies 404 as fatal", () => {
      const error = new Error("404 not found");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Resource not found");
    });

    it("classifies 400 bad request as fatal", () => {
      const error = new Error("400 bad request");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Invalid request");
    });

    it("classifies 422 unprocessable entity as fatal", () => {
      const error = new Error("422 unprocessable entity");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Invalid request");
    });

    it("defaults unknown errors to fatal", () => {
      const error = new Error("something unexpected");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Unknown error");
    });

    it("is case-insensitive for error message matching", () => {
      const error = new Error("RATE LIMIT EXCEEDED");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
    });

    it("extracts custom retry-after from error message when available", () => {
      const error = new Error("429 rate limit, retry-after: 120");
      const result = classifyCatalogError(error);
      expect(result.type).toBe("retryable");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(120);
      }
    });
  });

  describe("extractRetryAfter", () => {
    it("extracts retry-after seconds from error message", () => {
      const error = new Error("429 rate limit, retry-after: 60");
      const result = extractRetryAfter(error);
      expect(result).toBe(60);
    });

    it("returns undefined when retry-after not present", () => {
      const error = new Error("429 rate limit");
      const result = extractRetryAfter(error);
      expect(result).toBeUndefined();
    });

    it("handles case-insensitive retry-after matching", () => {
      const error = new Error("RETRY-AFTER: 120");
      const result = extractRetryAfter(error);
      expect(result).toBe(120);
    });

    it("handles lowercase retry-after", () => {
      const error = new Error("retry-after: 45");
      const result = extractRetryAfter(error);
      expect(result).toBe(45);
    });

    it("handles mixed case retry-after", () => {
      const error = new Error("Retry-After: 30");
      const result = extractRetryAfter(error);
      expect(result).toBe(30);
    });

    it("extracts retry-after with spaces around colon", () => {
      const error = new Error("429 rate limit, retry-after: 90");
      const result = extractRetryAfter(error);
      expect(result).toBe(90);
    });
  });

  describe("createRetryableClassification", () => {
    it("creates valid retryable classification", () => {
      const result = createRetryableClassification(60, "Rate limited");
      expect(result.type).toBe("retryable");
      if (isRetryable(result)) {
        expect(result.retryAfter).toBe(60);
      }
      expect(result.reason).toBe("Rate limited");
    });

    it("throws error when retryAfter is zero", () => {
      expect(() => createRetryableClassification(0, "test")).toThrow("retryAfter must be a positive number");
    });

    it("throws error when retryAfter is negative", () => {
      expect(() => createRetryableClassification(-1, "test")).toThrow("retryAfter must be a positive number");
    });

    it("throws error when reason is empty", () => {
      expect(() => createRetryableClassification(60, "   ")).toThrow("reason cannot be empty");
    });

    it("throws error when reason is only whitespace", () => {
      expect(() => createRetryableClassification(60, "\n\t")).toThrow("reason cannot be empty");
    });
  });

  describe("createFatalClassification", () => {
    it("creates valid fatal classification", () => {
      const result = createFatalClassification("Not found");
      expect(result.type).toBe("fatal");
      expect(result.reason).toBe("Not found");
    });

    it("throws error when reason is empty", () => {
      expect(() => createFatalClassification("")).toThrow("reason cannot be empty");
    });

    it("throws error when reason is only whitespace", () => {
      expect(() => createFatalClassification("   ")).toThrow("reason cannot be empty");
    });
  });

  describe("isRetryable", () => {
    it("returns true for retryable classification", () => {
      const classification = createRetryableClassification(60, "test");
      if (isRetryable(classification)) {
        expect(classification.retryAfter).toBe(60);
        expect(classification.reason).toBe("test");
      } else {
        throw new Error("Expected retryable");
      }
    });

    it("returns false for fatal classification", () => {
      const classification = createFatalClassification("test");
      expect(isRetryable(classification)).toBe(false);
    });

    it("narrows type correctly in type guards", () => {
      const result1 = createRetryableClassification(60, "test");
      const result2 = createFatalClassification("test");

      if (isRetryable(result1)) {
        expect(result1.retryAfter).toBeDefined();
      }

      if (isRetryable(result2)) {
        throw new Error("Should not be retryable");
      }
    });
  });
});
