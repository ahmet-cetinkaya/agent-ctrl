/**
 * Error classification for catalog operations.
 */
export type ErrorClassification =
  | { type: "retryable"; retryAfter: number; reason: string }
  | { type: "fatal"; reason: string };

/**
 * Creates a retryable error classification with validation.
 */
export function createRetryableClassification(retryAfter: number, reason: string): ErrorClassification {
  if (retryAfter <= 0) {
    throw new Error("retryAfter must be a positive number");
  }
  if (!reason.trim()) {
    throw new Error("reason cannot be empty");
  }
  return { type: "retryable", retryAfter, reason };
}

/**
 * Creates a fatal error classification with validation.
 */
export function createFatalClassification(reason: string): ErrorClassification {
  if (!reason.trim()) {
    throw new Error("reason cannot be empty");
  }
  return { type: "fatal", reason };
}

/**
 * Type guard to check if classification is retryable.
 */
export function isRetryable(
  classification: ErrorClassification
): classification is { type: "retryable"; retryAfter: number; reason: string } {
  return classification.type === "retryable";
}

/**
 * Classifies an error for catalog synchronization operations.
 */
export function classifyCatalogError(error: Error): ErrorClassification {
  const message = error.message.toLowerCase();

  // Rate limiting (429) - retryable with Retry-After header
  if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
    const retryAfter = extractRetryAfter(error);
    return createRetryableClassification(retryAfter ?? 60, "Rate limited by API");
  }

  // Timeout errors - retryable
  if (message.includes("timed out") || error.name === "AbortError") {
    return createRetryableClassification(5, "Request timeout");
  }

  // Network errors - retryable
  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    message.includes("fetch failed")
  ) {
    return createRetryableClassification(10, "Network error");
  }

  // Server errors (5xx) - retryable
  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return createRetryableClassification(30, "Server error");
  }

  // Authentication failures (401) - fatal
  if (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("authentication failed") ||
    message.includes("api key") ||
    message.includes("invalid token")
  ) {
    return createFatalClassification("Authentication failed");
  }

  // Authorization failures (403) - fatal
  if (
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("unauthorized") ||
    message.includes("access denied")
  ) {
    return createFatalClassification("Authorization failed");
  }

  // Not found errors (404) - fatal for critical endpoints
  if (message.includes("404") || message.includes("not found")) {
    return createFatalClassification("Resource not found");
  }

  // Client errors (4xx) other than 429 - fatal
  if (message.includes("400") || message.includes("422") || message.includes("bad request") || message.includes("invalid")) {
    return createFatalClassification("Invalid request");
  }

  // Default to fatal for unknown errors
  return createFatalClassification("Unknown error");
}

/**
 * Extracts retry-after seconds from error message if present.
 * Expected format: 'Retry-After: 42' (HTTP header or API message)
 */
export function extractRetryAfter(error: Error): number | undefined {
  const match = error.message.match(/retry-after:\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}
