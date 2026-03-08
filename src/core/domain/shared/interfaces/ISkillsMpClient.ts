import type { CatalogItemMetadata } from "@/core/domain/shared/entities/CatalogItem";
import type { Result } from "@/core/domain/shared/value-objects/Result";

export interface SkillsMpSearchParams {
  query: string;
  page?: number;
  limit?: number;
  ai?: boolean;
  category?: string;
}

export interface SkillsMpSkillRecord {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  categories: string[];
  version?: string;
  sourceUrl?: string;
  metadata?: CatalogItemMetadata;
}

export interface SkillsMpSearchResponse {
  skills: SkillsMpSkillRecord[];
  page: number;
  limit: number;
  total?: number;
  rateLimit?: {
    dailyLimit?: number;
    dailyRemaining?: number;
  };
}

export interface SkillsMpSkillDetails extends SkillsMpSkillRecord {
  installation?: {
    skillMarkdown?: string;
    files?: Record<string, string>;
  };
}

export interface ISkillsMpClient {
  search(params: SkillsMpSearchParams): Promise<Result<SkillsMpSearchResponse, Error>>;
  getSkillDetails(skillId: string, hint?: SkillsMpSkillRecord): Promise<Result<SkillsMpSkillDetails, Error>>;
}
