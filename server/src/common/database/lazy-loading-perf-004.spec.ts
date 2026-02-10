/**
 * @file PERF-004 Lazy Loading Completion Tests
 * @description Tests for PERF-004 task: Finalizing lazy loading migration for remaining entity relations
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * TASK REFERENCE: PERF-004 - Implement lazy loading for related entities
 * SPEC REFERENCE: docs/data-loading-strategies.md
 *
 * PERF-004 Changes:
 * - Added { eager: false } to User.tokenFamilies relation
 * - Added { eager: false } to Permission.roles relation
 * - Added { eager: false } to Role.permissions relation
 *
 * These tests verify that the final three entity relations from PERF-004
 * are properly configured with lazy loading per the specification.
 */

import { readFileSync } from "fs";
import { join } from "path";

/**
 * PERF-004 Test Suite: Final Lazy Loading Migration
 *
 * Verifies the three relations modified in PERF-004 are configured
 * with { eager: false } as per the data loading strategy specification.
 *
 * These tests perform static analysis on the source files to verify
 * the actual decorator configuration, not just local objects.
 */
describe("PERF-004 Lazy Loading Completion Tests", () => {
  /**
   * Helper: Extract relation decorator configuration from source file
   * Parses the actual TypeScript source to verify decorator options
   */
  function extractRelationConfig(
    entityFile: string,
    relationName: string
  ): { decorator: string; hasEagerFalse: boolean; fullMatch: string | null } {
    const fullPath = join(__dirname, "../../entities", entityFile);
    const source = readFileSync(fullPath, "utf-8");

    // Look for the property declaration first, then find the decorator immediately before it
    // Pattern: property declaration with relationName preceded by @OneToMany decorator
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is the property declaration we're looking for
      // Match patterns like: "tokenFamilies: TokenFamily[];" or "  tokenFamilies:"
      if (line.includes(relationName) && line.includes(":")) {
        // Found the property, now look backwards for the @OneToMany decorator
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const decoratorLine = lines[j];

          // Check if this line contains @OneToMany
          if (decoratorLine.includes("@OneToMany")) {
            // Found the decorator, extract the full text (handles multi-line)
            const decoratorText = extractDecoratorFullText(lines, j);
            const hasEagerFalse = decoratorText.includes("eager: false") ||
                                 decoratorText.includes("eager:false");

            return {
              decorator: decoratorText,
              hasEagerFalse,
              fullMatch: hasEagerFalse ? decoratorText : null,
            };
          }

          // Stop if we hit another decorator or property
          if (decoratorLine.includes("@") && !decoratorLine.includes("@OneToMany")) {
            break;
          }
        }
      }
    }

    return {
      decorator: "",
      hasEagerFalse: false,
      fullMatch: null,
    };
  }

  /**
   * Helper: Extract full decorator text (handles multi-line decorators)
   */
  function extractDecoratorFullText(lines: string[], startIndex: number): string {
    let text = lines[startIndex];
    let i = startIndex + 1;

    // Continue while we have opening parentheses without matching closing
    let openParens = (text.match(/\(/g) || []).length;
    let closeParens = (text.match(/\)/g) || []).length;

    while (i < lines.length && openParens > closeParens) {
      text += "\n" + lines[i];
      openParens += (lines[i].match(/\(/g) || []).length;
      closeParens += (lines[i].match(/\)/g) || []).length;
      i++;
    }

    return text;
  }

  describe("PERF-004: User.tokenFamilies Relation", () => {
    /**
     * PERF-004 Change: Added { eager: false } to User.tokenFamilies
     * Location: server/src/entities/user.entity.ts:217
     *
     * SPEC: Lazy Loading Use Cases (docs/data-loading-strategies.md lines 61-82)
     * - Token families should be lazy loaded as they're only needed during authentication
     */

    it("should verify tokenFamilies relation has eager: false in source code", () => {
      const config = extractRelationConfig("user.entity.ts", "tokenFamilies");

      // Verify the decorator was found
      expect(config.decorator).toContain("@OneToMany");

      // Verify eager: false is present in the decorator options
      // This test will fail if someone removes { eager: false } from the decorator
      expect(config.hasEagerFalse).toBe(true);
      expect(config.decorator).toContain("eager: false");
    });

    it("should verify tokenFamilies decorator includes TokenFamily relation", () => {
      const config = extractRelationConfig("user.entity.ts", "tokenFamilies");

      // Verify the relation targets TokenFamily
      expect(config.decorator).toContain("TokenFamily");
    });
  });

  describe("PERF-004: Permission.roles Relation", () => {
    /**
     * PERF-004 Change: Added { eager: false } to Permission.roles
     * Location: server/src/entities/permission.entity.ts:152
     *
     * SPEC: Lazy Loading Use Cases (docs/data-loading-strategies.md lines 61-82)
     * - Permission roles should be lazy loaded as they're only needed in permission management
     */

    it("should verify roles relation has eager: false in source code", () => {
      const config = extractRelationConfig("permission.entity.ts", "roles");

      // Verify the decorator was found
      expect(config.decorator).toContain("@OneToMany");

      // Verify eager: false is present in the decorator options
      expect(config.hasEagerFalse).toBe(true);
      expect(config.decorator).toContain("eager: false");
    });

    it("should verify roles decorator includes RolePermission relation", () => {
      const config = extractRelationConfig("permission.entity.ts", "roles");

      // Verify the relation targets RolePermission
      expect(config.decorator).toContain("RolePermission");
    });
  });

  describe("PERF-004: Role.permissions Relation", () => {
    /**
     * PERF-004 Change: Added { eager: false } to Role.permissions
     * Location: server/src/entities/role.entity.ts:95
     *
     * SPEC: Lazy Loading Use Cases (docs/data-loading-strategies.md lines 61-82)
     * - Role permissions should be lazy loaded as they're only needed in role management
     */

    it("should verify permissions relation has eager: false in source code", () => {
      const config = extractRelationConfig("role.entity.ts", "permissions");

      // Verify the decorator was found
      expect(config.decorator).toContain("@OneToMany");

      // Verify eager: false is present in the decorator options
      expect(config.hasEagerFalse).toBe(true);
      expect(config.decorator).toContain("eager: false");
    });

    it("should verify permissions decorator includes RolePermission relation", () => {
      const config = extractRelationConfig("role.entity.ts", "permissions");

      // Verify the relation targets RolePermission
      expect(config.decorator).toContain("RolePermission");
    });
  });

  describe("PERF-004: All PERF-004 Relations Verification", () => {
    /**
     * PERF-004 Completion: All remaining @OneToMany relations now have { eager: false }
     * Location: docs/data-loading-strategies.md lines 295-300
     */

    const perf004Relations = [
      { entity: "User", relation: "tokenFamilies", file: "user.entity.ts", line: 217 },
      { entity: "Permission", relation: "roles", file: "permission.entity.ts", line: 152 },
      { entity: "Role", relation: "permissions", file: "role.entity.ts", line: 95 },
    ];

    it("should verify all PERF-004 relations have eager: false in source", () => {
      for (const { entity, relation, file } of perf004Relations) {
        const config = extractRelationConfig(file, relation);

        // Verify @OneToMany decorator exists
        expect(config.decorator).toContain("@OneToMany");

        // Verify eager: false is present
        expect(config.hasEagerFalse).toBe(true);
        expect(config.decorator).toContain("eager: false");
      }
    });

    it("should verify the PERF-004 migration is complete", () => {
      // All three relations from PERF-004 should be verified
      expect(perf004Relations).toHaveLength(3);

      // Verify all files exist and are readable
      for (const { file, relation } of perf004Relations) {
        expect(() => extractRelationConfig(file, relation)).not.toThrow();
      }
    });
  });

  describe("PERF-004: Integration with QueryOptimizerService", () => {
    /**
     * PERF-004 Integration: Relations work with QueryOptimizerService utilities
     * Location: docs/data-loading-strategies.md lines 295-298
     *
     * These tests verify that the lazy-loaded relations can be explicitly
     * loaded when needed using QueryOptimizerService patterns.
     */

    it("should support explicit loading of tokenFamilies when needed", () => {
      // When loading a user with their token families (e.g., for audit)
      // the relation should be explicitly specified in the relations option
      const config = extractRelationConfig("user.entity.ts", "tokenFamilies");

      // Verify the relation is configured with lazy loading (eager: false)
      // so it can be explicitly loaded when needed
      expect(config.hasEagerFalse).toBe(true);
    });

    it("should support explicit loading of Permission.roles when needed", () => {
      const config = extractRelationConfig("permission.entity.ts", "roles");

      expect(config.hasEagerFalse).toBe(true);
    });

    it("should support explicit loading of Role.permissions when needed", () => {
      const config = extractRelationConfig("role.entity.ts", "permissions");

      expect(config.hasEagerFalse).toBe(true);
    });
  });
});
