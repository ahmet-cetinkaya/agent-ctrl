export type { IFileValidator } from "./IFileValidator";
export type {
  IPlatformAdapter,
  PlatformConfig,
  IAppyPlatformAdapter,
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  ApplyPlatformScope,
  ApplyPlatformStatus,
} from "./IPlatformAdapter";
export type { IAgentScanner, AgentScanResult } from "./IAgentScanner";
export type { IFileSystem, FileSystemEntry } from "./IFileSystem";
export type {
  IMcpConfigLoader,
  McpIssue,
  McpLoadedServer,
  McpFileResult,
  McpLoadReport,
  McpLoadResult,
} from "./IMcpConfigLoader";
export type { ICatalogStateStore, CatalogState } from "./ICatalogStateStore";
export type {
  ISkillsMpClient,
  SkillsMpSearchParams,
  SkillsMpSearchResponse,
  SkillsMpSkillRecord,
  SkillsMpSkillDetails,
} from "./ISkillsMpClient";
export type {
  ISmitheryRegistryClient,
  SmitherySearchParams,
  SmitherySearchResponse,
  SmitheryServerRecord,
  SmitheryServerDetails,
} from "./ISmitheryRegistryClient";
export type { BaseError } from "@/core/domain/shared/errors/BaseError";
export type { UserError } from "@/core/domain/shared/errors/UserError";
export type { SystemError } from "@/core/domain/shared/errors/SystemError";
