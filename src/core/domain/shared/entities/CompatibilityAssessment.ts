import type { CompatibilityState } from "./CatalogTypes";

export interface CompatibilityAssessment {
  catalogKey: string;
  state: CompatibilityState;
  checkedAt: string;
  reasons: string[];
  requiredConstraints: string[];
}

export function createCompatibilityAssessment(input: CompatibilityAssessment): CompatibilityAssessment {
  return {
    ...input,
    reasons: [...input.reasons],
    requiredConstraints: [...input.requiredConstraints],
  };
}
