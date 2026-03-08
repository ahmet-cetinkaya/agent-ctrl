import type { CatalogItemMetadata } from "@/core/domain/shared/entities/CatalogItem";
import type { Result } from "@/core/domain/shared/value-objects/Result";

export interface SmitherySearchParams {
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface SmitheryServerRecord {
  id: string;
  qualifiedName: string;
  displayName: string;
  description?: string;
  capabilities: string[];
  categories: string[];
  version?: string;
  homepage?: string;
  metadata?: CatalogItemMetadata;
}

export interface SmitherySearchResponse {
  servers: SmitheryServerRecord[];
  page: number;
  pageSize: number;
  totalPages?: number;
  totalCount?: number;
}

export interface SmitheryServerDetails extends SmitheryServerRecord {
  metadata?: CatalogItemMetadata;
}

export interface ISmitheryRegistryClient {
  listServers(params: SmitherySearchParams): Promise<Result<SmitherySearchResponse, Error>>;
  getServerDetails(id: string): Promise<Result<SmitheryServerDetails, Error>>;
}
