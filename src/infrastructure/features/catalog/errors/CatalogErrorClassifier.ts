/**
 * Error classification for catalog operations.
 */
export type ErrorClassification =
  | { type: "retryable"; retryAfter?: number; reason: string }
  | { type: "fatal"; reason: string };

/**
 * Classifies an error for catalog synchronization operations.
 */
export function classifyCatalogError(error: Error): ErrorClassification {
  const message = error.message.toLowerCase();

  // Rate limiting (429) - retryable with Retry-After header
  if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
    return {
      type: "retryable",
      reason: "Rate limited by API",
    };
  }

  // Timeout errors - retryable
  if (message.includes("timed out") || error.name === "AbortError") {
    return {
      type: "retryable",
      reason: "Request timeout",
    };
  }

  // Network errors - retryable
  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    message.includes("fetch failed")
  ) {
    return {
      type: "retryable",
      reason: "Network error",
    };
  }

  // Server errors (5xx) - retryable
  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return {
      type: "retryable",
      reason: "Server error",
    };
  }

  // Authentication failures (401) - fatal
  if (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("authentication failed") ||
    message.includes("api key") ||
    message.includes("invalid token")
  ) {
    return {
      type: "fatal",
      reason: "Authentication failed",
    };
  }

  // Authorization failures (403) - fatal
  if (
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("unauthorized") ||
    message.includes("access denied")
  ) {
    return {
      type: "fatal",
      reason: "Authorization failed",
    };
  }

  // Not found errors (404) - fatal for critical endpoints
  if (message.includes("404") || message.includes("not found")) {
    return {
      type: "fatal",
      reason: "Resource not found",
    };
  }

  // Client errors (4xx) other than 429 - fatal
  if (message.includes("400") || message.includes("422") || message.includes("bad request") || message.includes("invalid")) {
    return {
      type: "fatal",
      reason: "Invalid request",
    };
  }

  // Default to fatal for unknown errors
  return {
    type: "fatal",
    reason: "Unknown error",
  };
}

/**
 * Extracts retry-after seconds from error message if present.
 */
export function extractRetryAfter(error: Error): number | undefined {
  const match = error.message.match(/retry-after:\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}
