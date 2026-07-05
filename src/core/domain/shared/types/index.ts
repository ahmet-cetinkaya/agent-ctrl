/**
 * Shared type interfaces for platform-specific settings feature.
 *
 * This module exports all domain types used across the platform-specific
 * settings implementation, ensuring type consistency and reusability.
 *
 * @module types
 */

// Core domain entities
export type { PlatformSettingsDirectory, PlatformSettingsState } from "./PlatformSettingsDirectory.js";
export type { FileOperation, FileSystemEntityType, FileOperationStatus, OverrideAction } from "./FileOperation.js";
export type { PlatformValidationResult } from "./PlatformValidationResult.js";
export type { SecurityValidationResult, SecurityContext, SecurityValidationType } from "./SecurityValidationResult.js";

// Re-export platform types for convenience
export type { SupportedApplyPlatform } from "./SupportedApplyPlatform.js";
