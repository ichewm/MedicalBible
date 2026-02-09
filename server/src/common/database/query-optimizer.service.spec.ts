/**
 * @file Query Optimizer Service Unit Tests
 * @description Unit tests for query optimization utilities
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { QueryOptimizerService } from "./query-optimizer.service";
import { JoinStrategy, COMMON_RELATION_PATHS } from "./query-optimizer.service";

describe("QueryOptimizerService", () => {
  let service: QueryOptimizerService;

  beforeEach(() => {
    service = new QueryOptimizerService();
  });

  describe("buildRelations", () => {
    it("should build simple relations", () => {
      const result = service.buildRelations(["user", "profile"]);
      expect(result).toEqual({ user: true, profile: true });
    });

    it("should build nested relations from dot notation", () => {
      const result = service.buildRelations(["user.profile", "user.address"]);
      expect(result).toEqual({
        user: { profile: true, address: true },
      });
    });

    it("should combine base and additional relations", () => {
      const result = service.buildRelations(
        ["user"],
        ["profile", "settings"],
      );
      expect(result).toEqual({
        user: true,
        profile: true,
        settings: true,
      });
    });

    it("should handle empty relation arrays", () => {
      const result = service.buildRelations([]);
      expect(result).toEqual({});
    });

    it("should handle undefined additional relations", () => {
      const result = service.buildRelations(["user"]);
      expect(result).toEqual({ user: true });
    });
  });

  describe("detectN1Pattern", () => {
    it("should detect N+1 pattern from loop with relation loading", () => {
      const warning = service.detectN1Pattern({
        hasLoop: true,
      });
      expect(warning).toContain("N+1 issue");
    });

    it("should detect N+1 pattern from loading relations after query", () => {
      const warning = service.detectN1Pattern({
        loadsRelationsAfterQuery: true,
      });
      expect(warning).toContain("relations after initial query");
    });

    it("should detect potential N+1 from find without relations", () => {
      const warning = service.detectN1Pattern({
        usesFindWithoutRelations: true,
      });
      expect(warning).toContain("N+1 issues");
    });

    it("should return null when no N+1 pattern detected", () => {
      const warning = service.detectN1Pattern({});
      expect(warning).toBeNull();
    });
  });

  describe("validateRelations", () => {
    it("should pass validation when all required relations present", () => {
      const result = service.validateRelations(
        ["user", "profile", "settings"],
        ["user", "profile"],
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should detect missing required relations", () => {
      const result = service.validateRelations(
        ["user", "profile"],
        ["user", "profile", "settings"],
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["settings"]);
    });

    it("should handle nested relations in object format", () => {
      const result = service.validateRelations(
        { user: { profile: true } },
        ["user.profile"],
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should detect missing nested relations", () => {
      const result = service.validateRelations(
        { user: true },
        ["user.profile"],
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["user.profile"]);
    });
  });

  describe("getRecommendedRelations", () => {
    it("should return relations for user with level", () => {
      const relations = service.getRecommendedRelations("USER_LEVEL");
      expect(relations).toEqual(COMMON_RELATION_PATHS.USER_LEVEL);
    });

    it("should return relations for full paper", () => {
      const relations = service.getRecommendedRelations("PAPER_FULL");
      expect(Array.from(relations)).toContain("subject");
      expect(Array.from(relations)).toContain("subject.level");
    });
  });

  describe("flattenRelations", () => {
    it("should flatten simple relations object", () => {
      const flattened = (service as any).flattenRelations({
        user: true,
        profile: true,
      });
      expect(flattened).toEqual(["user", "profile"]);
    });

    it("should flatten nested relations object", () => {
      const flattened = (service as any).flattenRelations({
        user: { profile: true, address: true },
        settings: true,
      });
      expect(flattened).toEqual(["user.profile", "user.address", "settings"]);
    });

    it("should handle empty relations object", () => {
      const flattened = (service as any).flattenRelations({});
      expect(flattened).toEqual([]);
    });

    it("should skip false boolean values", () => {
      const flattened = (service as any).flattenRelations({
        user: true,
        profile: false,
      });
      expect(flattened).toEqual(["user"]);
    });
  });

  describe("getAlias", () => {
    it("should replace dots with underscores", () => {
      const alias = (service as any).getAlias("user.profile.address");
      expect(alias).toBe("user_profile_address");
    });

    it("should handle simple relation without dots", () => {
      const alias = (service as any).getAlias("user");
      expect(alias).toBe("user");
    });
  });
});
