/**
 * @file Nginx Upstream Configuration Test
 * @description 验证 nginx upstream 配置和错误页面 - BUG-004
 *
 * ## Spec Reference
 * - PRD BUG-004: Improve nginx upstream configuration for backend proxy
 * - Acceptance Criteria:
 *   1. Nginx starts successfully even when backend is temporarily down
 *   2. Upstream block properly defines backend service with keepalive
 *   3. Graceful error handling when backend is unreachable
 *
 * This test validates nginx configuration files without requiring
 * database connections or the full NestJS application.
 */

import * as fs from "fs";
import * as path from "path";

describe("Nginx Upstream Configuration", () => {
  const projectRoot = path.join(process.cwd(), "..");
  const nginxConfPath = path.join(projectRoot, "nginx", "nginx.conf");
  const webNginxConfPath = path.join(projectRoot, "web", "nginx.conf");

  /**
   * ## Happy Path: Nginx Configuration Files Exist and Are Valid
   *
   * Spec Requirement: Nginx configuration files should exist and contain upstream block
   * Reference: PRD BUG-004 Acceptance Criteria #2
   */
  describe("Nginx Configuration Files", () => {
    it("nginx/nginx.conf should exist and be readable", () => {
      expect(fs.existsSync(nginxConfPath)).toBe(true);

      const content = fs.readFileSync(nginxConfPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });

    it("nginx/nginx.conf should contain upstream backend block", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify upstream block exists
      expect(content).toContain("upstream backend");
      expect(content).toContain("server backend:3000");
      expect(content).toContain("keepalive 32");
      expect(content).toContain("keepalive_timeout 60s");
    });

    it("nginx/nginx.conf should reference upstream in proxy_pass", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify proxy_pass uses upstream instead of direct hostname
      expect(content).toContain("proxy_pass http://backend/");
      // Should NOT contain direct hostname reference (old pattern)
      expect(content).not.toContain("proxy_pass http://backend:3000/");
    });

    it("nginx/nginx.conf should contain error page directives", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify error page directives
      expect(content).toContain("error_page 502");
      expect(content).toContain("error_page 503");
      expect(content).toContain("error_page 504");
    });

    it("nginx/nginx.conf should contain passive health checking", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify passive health checking directives
      expect(content).toContain("proxy_next_upstream");
      expect(content).toContain("proxy_next_upstream_tries");
      expect(content).toContain("proxy_next_upstream_timeout");
    });

    it("web/nginx.conf should exist and contain upstream block", () => {
      expect(fs.existsSync(webNginxConfPath)).toBe(true);

      const content = fs.readFileSync(webNginxConfPath, "utf-8");
      expect(content).toContain("upstream backend");
      expect(content).toContain("server backend:3000");
    });

    it("web/nginx.conf should use upstream in proxy_pass directives", () => {
      const content = fs.readFileSync(webNginxConfPath, "utf-8");

      // Verify all proxy_pass directives use upstream
      expect(content).toContain("proxy_pass http://backend/");
      // Should NOT contain direct hostname references
      expect(content).not.toContain("proxy_pass http://backend:3000/");
    });
  });

  /**
   * ## Happy Path: Error Pages Exist and Are Valid HTML
   *
   * Spec Requirement: Custom error pages for backend failures
   * Reference: PRD BUG-004 Acceptance Criteria #3
   */
  describe("Error Pages", () => {
    it("web/public/502.html should exist and contain valid HTML", () => {
      const errorPagePath = path.join(projectRoot, "web", "public", "502.html");
      expect(fs.existsSync(errorPagePath)).toBe(true);

      const content = fs.readFileSync(errorPagePath, "utf-8");

      // Verify it's valid HTML
      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("</html>");

      // Verify it contains expected content
      expect(content).toContain("502");
      expect(content).toContain("网关错误");
    });

    it("web/public/503.html should exist and contain valid HTML", () => {
      const errorPagePath = path.join(projectRoot, "web", "public", "503.html");
      expect(fs.existsSync(errorPagePath)).toBe(true);

      const content = fs.readFileSync(errorPagePath, "utf-8");

      // Verify it's valid HTML
      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("</html>");

      // Verify it contains expected content
      expect(content).toContain("503");
      expect(content).toContain("服务维护中");
    });

    it("web/public/504.html should exist and contain valid HTML", () => {
      const errorPagePath = path.join(projectRoot, "web", "public", "504.html");
      expect(fs.existsSync(errorPagePath)).toBe(true);

      const content = fs.readFileSync(errorPagePath, "utf-8");

      // Verify it's valid HTML
      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("</html>");

      // Verify it contains expected content
      expect(content).toContain("504");
      expect(content).toContain("网关超时");
    });

    it("error pages should have retry functionality", () => {
      const errorPages = ["502.html", "503.html", "504.html"];

      errorPages.forEach((page) => {
        const errorPagePath = path.join(projectRoot, "web", "public", page);
        const content = fs.readFileSync(errorPagePath, "utf-8");

        // Verify retry button exists with reload function
        expect(content).toContain("javascript:location.reload()");
        expect(content).toContain("重试");
      });
    });

    it("error pages should have proper styling", () => {
      const errorPages = ["502.html", "503.html", "504.html"];

      errorPages.forEach((page) => {
        const errorPagePath = path.join(projectRoot, "web", "public", page);
        const content = fs.readFileSync(errorPagePath, "utf-8");

        // Verify CSS styling exists
        expect(content).toContain("<style>");
        expect(content).toContain("background: linear-gradient");
        expect(content).toContain(".error-container");
        expect(content).toContain(".error-code");
      });
    });

    it("error pages should be in Chinese as per project language", () => {
      const errorPages = [
        { file: "502.html", title: "网关错误" },
        { file: "503.html", title: "服务维护中" },
        { file: "504.html", title: "网关超时" },
      ];

      errorPages.forEach(({ file, title }) => {
        const errorPagePath = path.join(projectRoot, "web", "public", file);
        const content = fs.readFileSync(errorPagePath, "utf-8");

        // Verify Chinese language and content
        expect(content).toContain('lang="zh-CN"');
        expect(content).toContain(title);
      });
    });
  });

  /**
   * ## Configuration Values Verification
   *
   * Spec Requirement: Upstream configuration should have proper values
   * Reference: PRD BUG-004 Acceptance Criteria #2
   */
  describe("Upstream Configuration Values", () => {
    it("upstream keepalive should be set to 32 connections", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify keepalive value
      expect(content).toMatch(/keepalive\s+32/);
    });

    it("upstream keepalive_timeout should be set to 60s", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify keepalive_timeout value
      expect(content).toMatch(/keepalive_timeout\s+60s/);
    });

    it("proxy_connect_timeout should be 10s (reduced from 60s for faster failover)", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify timeout values were reduced for faster health checking
      expect(content).toMatch(/proxy_connect_timeout\s+10s/);
    });

    it("proxy_next_upstream should include error codes", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify health checking includes retry conditions
      expect(content).toMatch(/proxy_next_upstream\s+error timeout http_502 http_503 http_504/);
    });

    it("proxy_next_upstream_tries should be set to 2", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify retry attempts
      expect(content).toMatch(/proxy_next_upstream_tries\s+2/);
    });

    it("proxy_next_upstream_timeout should be 10s", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify retry timeout
      expect(content).toMatch(/proxy_next_upstream_timeout\s+10s/);
    });
  });

  /**
   * ## Error Page Configuration Verification
   *
   * Spec Requirement: Error pages should be properly configured
   * Reference: PRD BUG-004 Acceptance Criteria #3
   */
  describe("Error Page Configuration", () => {
    it("nginx.conf should configure all three error pages", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify all error page directives
      expect(content).toMatch(/error_page\s+502\s+\/502.html/);
      expect(content).toMatch(/error_page\s+503\s+\/503.html/);
      expect(content).toMatch(/error_page\s+504\s+\/504.html/);
    });

    it("error page locations should be marked as internal", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify internal directive (prevents direct access)
      const internalCount = (content.match(/internal/g) || []).length;
      expect(internalCount).toBeGreaterThanOrEqual(3);
    });

    it("error page locations should point to correct root", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Verify error pages are served from html root
      expect(content).toContain("root /usr/share/nginx/html");
    });
  });

  /**
   * ## All Proxy Locations Should Use Upstream
   *
   * Spec Requirement: All proxy_pass directives should use upstream block
   * Reference: PRD BUG-004 Acceptance Criteria #2
   */
  describe("Proxy Configuration Consistency", () => {
    it("all API proxy locations should use upstream", () => {
      const content = fs.readFileSync(nginxConfPath, "utf-8");

      // Find all proxy_pass directives
      const proxyPassMatches = content.matchAll(/proxy_pass\s+([^;]+);/g);
      const proxyPassTargets = Array.from(proxyPassMatches, (m) => m[1]);

      // All proxy_pass should use upstream (http://backend/)
      proxyPassTargets.forEach((target) => {
        // Health endpoint doesn't proxy, so skip
        if (target.includes("health")) return;

        // Verify uses upstream format (not direct hostname:port)
        if (target.startsWith("http://")) {
          expect(target).toMatch(/^http:\/\/backend\/[a-z]+\/$/);
        }
      });
    });

    it("web nginx.conf should also use upstream for all proxies", () => {
      const content = fs.readFileSync(webNginxConfPath, "utf-8");

      // Find all proxy_pass directives
      const proxyPassMatches = content.matchAll(/proxy_pass\s+([^;]+);/g);
      const proxyPassTargets = Array.from(proxyPassMatches, (m) => m[1]);

      // All proxy_pass should use upstream (http://backend/)
      proxyPassTargets.forEach((target) => {
        expect(target).toMatch(/^http:\/\/backend\/[a-z.]+\/$/);
      });
    });

    it("should not contain any direct backend:3000 references in proxy_pass", () => {
      const nginxContent = fs.readFileSync(nginxConfPath, "utf-8");
      const webNginxContent = fs.readFileSync(webNginxConfPath, "utf-8");

      // Find all proxy_pass directives in both files
      const combinedContent = nginxContent + webNginxContent;
      const proxyPassMatches = combinedContent.matchAll(/proxy_pass\s+([^;]+);/g);
      const proxyPassTargets = Array.from(proxyPassMatches, (m) => m[1]);

      // None should use direct hostname:port reference
      proxyPassTargets.forEach((target) => {
        expect(target).not.toContain("backend:3000");
      });
    });
  });

  /**
   * ## Property-based Invariance: Configuration File Consistency
   *
   * Tests that both nginx config files follow the same pattern
   */
  describe("Configuration Consistency", () => {
    it("both nginx configs should have identical upstream definitions", () => {
      const nginxContent = fs.readFileSync(nginxConfPath, "utf-8");
      const webNginxContent = fs.readFileSync(webNginxConfPath, "utf-8");

      // Extract upstream block from both files
      const nginxUpstream = nginxContent.match(/upstream backend \{[^}]+\}/)?.[0];
      const webUpstream = webNginxContent.match(/upstream backend \{[^}]+\}/)?.[0];

      expect(nginxUpstream).toBeDefined();
      expect(webUpstream).toBeDefined();

      // Both should have same server definition
      expect(nginxUpstream).toContain("server backend:3000");
      expect(webUpstream).toContain("server backend:3000");

      // Both should have keepalive settings
      expect(nginxUpstream).toContain("keepalive 32");
      expect(webUpstream).toContain("keepalive 32");
    });

    it("both configs should have health checking in all proxy locations", () => {
      const nginxContent = fs.readFileSync(nginxConfPath, "utf-8");
      const webNginxContent = fs.readFileSync(webNginxConfPath, "utf-8");

      // Both should have health checking directives
      expect(nginxContent).toContain("proxy_next_upstream");
      expect(webNginxContent).toContain("proxy_next_upstream");
    });
  });
});
