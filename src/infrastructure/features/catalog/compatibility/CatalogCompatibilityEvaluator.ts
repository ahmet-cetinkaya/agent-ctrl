import {
  createCompatibilityAssessment,
  type CatalogItem,
  type CompatibilityAssessment,
} from "@/core/domain/shared/entities";

export class CatalogCompatibilityEvaluator {
  evaluate(item: CatalogItem): CompatibilityAssessment {
    const forcedState = item.metadata?.compatibility?.state;
    const reasons = item.metadata?.compatibility?.reasons ?? [];
    const requiredConstraints = item.metadata?.compatibility?.requiredConstraints ?? [];

    if (forcedState) {
      return createCompatibilityAssessment({
        catalogKey: item.catalogKey,
        state: forcedState,
        checkedAt: new Date().toISOString(),
        reasons,
        requiredConstraints,
      });
    }

    if (item.capabilities.some((capability) => capability.toLowerCase().includes("requires-unavailable-runtime"))) {
      return createCompatibilityAssessment({
        catalogKey: item.catalogKey,
        state: "incompatible",
        checkedAt: new Date().toISOString(),
        reasons: ["Required runtime or capability is unavailable in the current environment."],
        requiredConstraints,
      });
    }

    return createCompatibilityAssessment({
      catalogKey: item.catalogKey,
      state: "unknown",
      checkedAt: new Date().toISOString(),
      reasons,
      requiredConstraints,
    });
  }

  canActivate(item: CatalogItem): { allowed: boolean; assessment: CompatibilityAssessment; message?: string } {
    const assessment = this.evaluate(item);
    if (assessment.state === "incompatible") {
      return {
        allowed: false,
        assessment,
        message: assessment.reasons.join(" ") || "Item is incompatible with the current environment.",
      };
    }

    return { allowed: true, assessment };
  }
}
