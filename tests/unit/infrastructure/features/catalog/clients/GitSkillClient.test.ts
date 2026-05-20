import { describe, it, expect } from "bun:test";
import { GitSkillClient } from "@/infrastructure/features/catalog/clients/GitSkillClient";

describe("GitSkillClient", () => {
  describe("parseRef", () => {
    it("rejects non-URL refs", async () => {
      const client = new GitSkillClient();
      const result = await client.getSkillDetails("git:invalid-ref");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid git skill URL");
      }
    });

    it("rejects URLs without enough path segments", async () => {
      const client = new GitSkillClient();
      const result = await client.getSkillDetails("git:https://github.com/owner/repo");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("owner/repo/tree/ref/path");
      }
    });

    it.skip("parses GitHub URL correctly", async () => {
      const client = new GitSkillClient({ githubTimeoutMs: 1000 });
      const result = await client.getSkillDetails(
        "git:https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("github.com");
      }
    });

    it.skip("parses non-GitHub URL correctly", async () => {
      const client = new GitSkillClient({ cloneTimeoutMs: 1000 });
      const result = await client.getSkillDetails("git:https://gitlab.com/owner/repo/-/tree/main/skills/my-skill");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("git");
      }
    });
  });
});
