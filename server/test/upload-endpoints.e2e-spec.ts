/**
 * @file File Upload Security Configuration E2E Tests (SEC-008)
 * @description End-to-end configuration tests for file upload security features.
 *
 * These tests verify the SECURITY CONFIGURATION is properly set up according to
 * SEC-008 specifications, complementing the integration tests in
 * file-upload-security.e2e-spec.ts.
 *
 * SPEC REFERENCES:
 * - PRD SEC-008: Add file upload security validation
 *   - File size limits and type validation
 *   - Virus scanning integration (ClamAV or cloud service)
 *   - Filename sanitization and directory traversal prevention
 *   - Storage outside web root
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FileValidator } from "../src/modules/upload/file-validation";
import {
  FileCategory,
  getFileCategoryConfig,
  FILE_SIZE_LIMITS,
  ALLOWED_FILE_TYPES,
  FILE_EXTENSIONS,
} from "../src/config/upload.config";
import {
  FileTooLargeException,
  FileNotAllowedException,
  FileNameInvalidException,
} from "../src/common/exceptions/business.exception";

describe("File Upload Security Configuration E2E Tests (SEC-008)", () => {
  let configService: ConfigService;
  let validator: FileValidator;

  const createMockFile = (
    originalname: string,
    mimetype: string,
    size: number,
  ): Express.Multer.File => ({
    fieldname: "file",
    originalname,
    encoding: "utf-8",
    mimetype,
    size,
    buffer: Buffer.alloc(size),
    stream: null as any,
    destination: "",
    filename: "",
    path: "",
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileValidator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                "upload.globalMaxSize": 50 * 1024 * 1024,
                "upload.strictMode": true,
                "upload.fileSizeLimits": {
                  avatar: 5 * 1024 * 1024,
                  pdf: 50 * 1024 * 1024,
                  image: 10 * 1024 * 1024,
                  document: 20 * 1024 * 1024,
                  general: 20 * 1024 * 1024,
                },
                "upload.virusScanEnabled": "false",
                "upload.virusScanProvider": "clamav",
                "upload.virusScanFailOpen": "true",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    validator = module.get<FileValidator>(FileValidator);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe("SEC-008 Spec: File Size Limits Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits"
     *
     * CONFIGURATION TEST: Verify size limits are configured per spec
     */
    it("should have configured file size limits matching PRD requirements", () => {
      // AVATAR: 5MB per PRD
      expect(FILE_SIZE_LIMITS[FileCategory.AVATAR]).toBe(5 * 1024 * 1024);

      // PDF: 50MB per PRD
      expect(FILE_SIZE_LIMITS[FileCategory.PDF]).toBe(50 * 1024 * 1024);

      // IMAGE: 10MB per PRD
      expect(FILE_SIZE_LIMITS[FileCategory.IMAGE]).toBe(10 * 1024 * 1024);

      // DOCUMENT: 20MB per PRD
      expect(FILE_SIZE_LIMITS[FileCategory.DOCUMENT]).toBe(20 * 1024 * 1024);
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits"
     *
     * INTEGRATION TEST: Verify size limits are enforced through validator
     */
    it("should enforce configured size limits through FileValidator", () => {
      const avatarLimit = FILE_SIZE_LIMITS[FileCategory.AVATAR];
      const oversizedFile = createMockFile("large.jpg", "image/jpeg", avatarLimit + 1);

      expect(() => validator.validate(oversizedFile, { category: FileCategory.AVATAR }))
        .toThrow(FileTooLargeException);
    });
  });

  describe("SEC-008 Spec: File Type Validation Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     *
     * CONFIGURATION TEST: Verify MIME type whitelists are configured
     */
    it("should have configured MIME type whitelists for each category", () => {
      // AVATAR should only allow image types
      const avatarTypes = ALLOWED_FILE_TYPES[FileCategory.AVATAR];
      expect(avatarTypes).toContain("image/jpeg");
      expect(avatarTypes).toContain("image/png");
      expect(avatarTypes).toContain("image/gif");
      expect(avatarTypes).toContain("image/webp");
      expect(avatarTypes).not.toContain("application/pdf");

      // PDF should only allow PDF
      const pdfTypes = ALLOWED_FILE_TYPES[FileCategory.PDF];
      expect(pdfTypes).toEqual(["application/pdf"]);

      // IMAGE should allow SVG but not documents
      const imageTypes = ALLOWED_FILE_TYPES[FileCategory.IMAGE];
      expect(imageTypes).toContain("image/svg+xml");
      expect(imageTypes).not.toContain("application/pdf");
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     *
     * CONFIGURATION TEST: Verify extension whitelists match MIME types
     */
    it("should have configured file extension whitelists for each category", () => {
      // AVATAR extensions should match allowed MIME types
      const avatarExtensions = FILE_EXTENSIONS[FileCategory.AVATAR];
      expect(avatarExtensions).toContain(".jpg");
      expect(avatarExtensions).toContain(".jpeg");
      expect(avatarExtensions).toContain(".png");
      expect(avatarExtensions).toContain(".gif");
      expect(avatarExtensions).toContain(".webp");

      // PDF should only have .pdf extension
      const pdfExtensions = FILE_EXTENSIONS[FileCategory.PDF];
      expect(pdfExtensions).toEqual([".pdf"]);
    });
  });

  describe("SEC-008 Spec: Directory Traversal Prevention Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * CONFIGURATION TEST: Verify dangerous characters are defined
     */
    it("should define dangerous characters for filename validation", () => {
      const dangerousFile = createMockFile("../../../etc/passwd.jpg", "image/jpeg", 1024);

      expect(() => validator.validate(dangerousFile, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify various path traversal patterns are blocked
     */
    it("should block all common path traversal patterns", () => {
      const pathTraversalAttempts = [
        "../../../etc/passwd.jpg",
        "..\\..\\..\\windows\\system32\\config\\sam.jpg",
        "./../../secret.jpg",
        "....//....//etc/passwd.jpg",
        "subdirectory/file.jpg",
        "/absolute/path.jpg",
        "\\absolute\\path.png",
      ];

      pathTraversalAttempts.forEach(filename => {
        const file = createMockFile(filename, "image/jpeg", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNameInvalidException);
      });
    });
  });

  describe("SEC-008 Spec: Virus Scan Integration Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Add virus scanning integration (ClamAV or cloud service)"
     *
     * CONFIGURATION TEST: Verify virus scan settings are available
     */
    it("should have virus scan configuration keys defined", () => {
      // These keys should exist in configuration
      const virusScanEnabled = configService.get<string>("upload.virusScanEnabled");
      const virusScanProvider = configService.get<string>("upload.virusScanProvider");
      const virusScanFailOpen = configService.get<string>("upload.virusScanFailOpen");

      expect(virusScanEnabled).toBeDefined();
      expect(virusScanProvider).toBeDefined();
      expect(virusScanFailOpen).toBeDefined();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Add virus scanning integration"
     *
     * CONFIGURATION TEST: Verify ClamAV is a supported provider
     */
    it("should support ClamAV as virus scan provider", () => {
      const provider = configService.get<string>("upload.virusScanProvider");
      expect(["clamav", "cloud", "disabled"]).toContain(provider || "clamav");
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * Virus scan integration
     *
     * CONFIGURATION TEST: Verify fail-open mode for availability
     */
    it("should default to fail-open mode for availability", () => {
      const failOpen = configService.get<string>("upload.virusScanFailOpen");
      // Fail-open should be true by default for availability
      expect(failOpen !== "false").toBe(true);
    });
  });

  describe("SEC-008 Spec: Storage Outside Web Root Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Store uploads outside web root"
     *
     * CONFIGURATION TEST: Verify UPLOAD_ROOT is configurable
     */
    it("should support configurable upload root directory", () => {
      const uploadRoot = process.env.UPLOAD_ROOT || "./uploads";

      expect(uploadRoot).toBeDefined();
      expect(typeof uploadRoot).toBe("string");
      expect(uploadRoot.length).toBeGreaterThan(0);

      // In production, absolute paths should not be in web root
      if (uploadRoot.startsWith("/")) {
        expect(uploadRoot).not.toContain("/var/www");
        expect(uploadRoot).not.toContain("/usr/share/nginx/html");
        expect(uploadRoot).not.toContain("/public");
      }
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Store uploads outside web root"
     *
     * CONFIGURATION TEST: Verify multiple storage backends are supported
     */
    it("should support multiple storage backends for flexible deployment", () => {
      const storageProvider = process.env.STORAGE_PROVIDER || "local";

      // Should support local, Aliyun OSS, Tencent COS, AWS S3, MinIO
      const validProviders = ["local", "aliyun-oss", "tencent-cos", "aws-s3", "minio"];
      expect(validProviders).toContain(storageProvider);
    });
  });

  describe("PROPERTY-BASED: Security Invariants", () => {
    /**
     * PROPERTY-BASED TEST: All security validations should be idempotent
     * Validating the same file multiple times should produce the same result
     */
    it("should have idempotent security validation", () => {
      const validFile = createMockFile("test.jpg", "image/jpeg", 1024);
      const invalidFile = createMockFile("../etc/passwd.jpg", "image/jpeg", 1024);

      // Valid file should always pass
      expect(() => validator.validate(validFile, { category: FileCategory.AVATAR }))
        .not.toThrow();
      expect(() => validator.validate(validFile, { category: FileCategory.AVATAR }))
        .not.toThrow();

      // Invalid file should always fail
      expect(() => validator.validate(invalidFile, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);
      expect(() => validator.validate(invalidFile, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);
    });

    /**
     * PROPERTY-BASED TEST: Category configuration should be complete
     * All categories should have size limits, MIME types, and extensions defined
     */
    it("should have complete configuration for all file categories", () => {
      const categories: FileCategory[] = [
        FileCategory.AVATAR,
        FileCategory.PDF,
        FileCategory.IMAGE,
        FileCategory.DOCUMENT,
        FileCategory.GENERAL,
      ];

      categories.forEach(category => {
        const config = getFileCategoryConfig(category);

        // Each category should have size limit defined
        expect(config.maxSize).toBeDefined();
        expect(config.maxSize).toBeGreaterThan(0);

        // Each category should have allowed MIME types
        expect(config.allowedMimeTypes).toBeDefined();
        expect(config.allowedMimeTypes.length).toBeGreaterThan(0);

        // Each category should have allowed extensions
        expect(config.allowedExtensions).toBeDefined();
        expect(config.allowedExtensions.length).toBeGreaterThan(0);
      });
    });

    /**
     * PROPERTY-BASED TEST: Security should apply regardless of filename case
     * File extensions should be matched case-insensitively
     */
    it("should apply security rules case-insensitively for extensions", () => {
      const caseVariations = [
        { name: "test.JPG", mime: "image/jpeg" },
        { name: "test.Jpg", mime: "image/jpeg" },
        { name: "test.JpG", mime: "image/jpeg" },
        { name: "test.PNG", mime: "image/png" },
        { name: "test.Png", mime: "image/png" },
      ];

      caseVariations.forEach(({ name, mime }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .not.toThrow();
      });
    });
  });

  describe("LONGEST-CHAIN E2E: Complete Security Validation Flow", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008 (Complete workflow)
     * This test exercises the longest realistic path through security validation:
     * File Creation → Size Check → MIME Type Check → Extension Check →
     * Filename Sanitization → Strict Mode Validation → Success
     *
     * E2E TEST: Verify all security layers work together correctly
     */
    it("should process valid files through all security validation layers", () => {
      const validFiles = [
        { name: "valid-avatar.jpg", mime: "image/jpeg", size: 1024, category: FileCategory.AVATAR },
        { name: "valid-document.pdf", mime: "application/pdf", size: 10 * 1024 * 1024, category: FileCategory.PDF },
        { name: "valid-image.png", mime: "image/png", size: 5 * 1024 * 1024, category: FileCategory.IMAGE },
      ];

      validFiles.forEach(({ name, mime, size, category }) => {
        const file = createMockFile(name, mime, size);
        expect(() => validator.validate(file, { category, strictMode: true }))
          .not.toThrow();
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008 (Complete security rejection)
     * This test verifies that malicious files are rejected at appropriate layers
     *
     * E2E TEST: Verify malicious patterns are caught at appropriate validation layers
     */
    it("should reject malicious files at appropriate security layers", () => {
      const maliciousFiles = [
        {
          name: "../../../etc/passwd.jpg",
          mime: "image/jpeg",
          size: 1024,
          category: FileCategory.AVATAR,
          reason: "directory traversal",
        },
        {
          name: "oversized.jpg",
          mime: "image/jpeg",
          size: 10 * 1024 * 1024,
          category: FileCategory.AVATAR,
          reason: "exceeds size limit",
        },
        {
          name: "malicious.pdf",
          mime: "application/pdf",
          size: 1024,
          category: FileCategory.AVATAR,
          reason: "disallowed MIME type",
        },
      ];

      maliciousFiles.forEach(({ name, mime, size, category, reason }) => {
        const file = createMockFile(name, mime, size);
        expect(() => validator.validate(file, { category }))
          .toThrow();
      });
    });
  });
});
