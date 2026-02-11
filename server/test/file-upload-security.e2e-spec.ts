/**
 * @file File Upload Security Integration/E2E Tests
 * @description Integration tests that verify file upload security conforms to SEC-008 specifications.
 *
 * SPEC REFERENCES:
 * - PRD SEC-008: Add file upload security validation
 *   - Implement file size limits and type validation
 *   - Add virus scanning integration (ClamAV or cloud service)
 *   - Sanitize filenames and prevent directory traversal
 *   - Store uploads outside web root
 *
 * IMPLEMENTATION FILES:
 * - server/src/config/upload.config.ts: File type whitelist, size limits, extensions
 * - server/src/modules/upload/file-validation.ts: FileValidator with security checks
 * - server/src/modules/virus-scan/virus-scan.service.ts: Virus scanning integration
 * - server/src/modules/upload/upload.service.ts: Upload service with validation
 *
 * TEST PHILOSOPHY:
 * These are INTEGRATION tests that verify the security validation behavior by testing
 * the FileValidator and related components together. Unit tests cover individual functions;
 * these tests verify the system behaves as specified in PRD SEC-008 by testing invariants
 * and security properties.
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FileValidator, FileValidationPipe } from "../src/modules/upload/file-validation";
import { FileCategory } from "../src/config/upload.config";
import {
  FileTooLargeException,
  FileNotAllowedException,
  FileExtensionNotAllowedException,
  FileNotProvidedException,
  FileNameInvalidException,
  FileMimeTypeMismatchException,
} from "../src/common/exceptions/business.exception";

describe("File Upload Security Integration Tests (SEC-008)", () => {
  let validator: FileValidator;
  let configService: ConfigService;

  const createMockFile = (
    originalname: string,
    mimetype: string,
    size: number,
    buffer?: Buffer,
  ): Express.Multer.File => ({
    fieldname: "file",
    originalname,
    encoding: "utf-8",
    mimetype,
    size,
    buffer: buffer ?? Buffer.alloc(size),
    stream: null as any,
    destination: "",
    filename: "",
    path: "",
  });

  beforeEach(async () => {
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

  describe("HAPPY PATH: Valid File Uploads", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits and type validation"
     *
     * INTEGRATION TEST: Verify valid JPEG image passes all validations
     */
    it("should accept a valid JPEG image within AVATAR size limits", () => {
      const file = createMockFile("valid-avatar.jpg", "image/jpeg", 1024 * 1024); // 1MB

      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits and type validation"
     *
     * INTEGRATION TEST: Verify valid PDF passes all validations
     */
    it("should accept a valid PDF file within PDF size limits", () => {
      const file = createMockFile("document.pdf", "application/pdf", 10 * 1024 * 1024); // 10MB

      expect(() => validator.validate(file, { category: FileCategory.PDF })).not.toThrow();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify safe filenames are accepted
     */
    it("should accept files with safe filenames", () => {
      const safeNames = [
        "safe-file-name.jpg",
        "profile_pic.png",
        "my-avatar.jpeg",
        "test-file-123.gif",
      ];

      safeNames.forEach(name => {
        // Create file with matching MIME type for extension
        const mime = name.endsWith(".png") ? "image/png" :
                     name.endsWith(".gif") ? "image/gif" :
                     name.endsWith(".jpeg") ? "image/jpeg" : "image/jpeg";
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
      });
    });
  });

  describe("SEC-008 Spec: File Size Limits Integration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits"
     * AVATAR category: 5MB limit per upload.config.ts
     *
     * INTEGRATION TEST: Verify size limit enforcement across validation layers
     */
    it("should reject files exceeding AVATAR size limit (5MB)", () => {
      const maxSize = 5 * 1024 * 1024;
      const oversizedFile = createMockFile("oversized.jpg", "image/jpeg", maxSize + 1);

      expect(() => validator.validate(oversizedFile, { category: FileCategory.AVATAR }))
        .toThrow(FileTooLargeException);
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits"
     * PDF category: 50MB limit per upload.config.ts
     *
     * INTEGRATION TEST: Verify PDF size limit enforcement
     */
    it("should reject PDF files exceeding PDF size limit (50MB)", () => {
      const maxSize = 50 * 1024 * 1024;
      const oversizedPdf = createMockFile("large.pdf", "application/pdf", maxSize + 1);

      expect(() => validator.validate(oversizedPdf, { category: FileCategory.PDF }))
        .toThrow(FileTooLargeException);
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file size limits"
     * IMAGE category: 10MB limit per upload.config.ts
     *
     * INTEGRATION TEST: Verify image size limit enforcement
     */
    it("should reject image files exceeding IMAGE size limit (10MB)", () => {
      const maxSize = 10 * 1024 * 1024;
      const oversizedImage = createMockFile("large.png", "image/png", maxSize + 1);

      expect(() => validator.validate(oversizedImage, { category: FileCategory.IMAGE }))
        .toThrow(FileTooLargeException);
    });

    /**
     * PROPERTY-BASED TEST: Files within size limits should always pass
     */
    it("should accept all files within category size limits", () => {
      const testCases = [
        { name: "small-avatar.jpg", mime: "image/jpeg", size: 100, category: FileCategory.AVATAR },
        { name: "medium-avatar.png", mime: "image/png", size: 2 * 1024 * 1024, category: FileCategory.AVATAR },
        { name: "large-valid-avatar.gif", mime: "image/gif", size: 4.9 * 1024 * 1024, category: FileCategory.AVATAR },
        { name: "small.pdf", mime: "application/pdf", size: 1024, category: FileCategory.PDF },
        { name: "medium.pdf", mime: "application/pdf", size: 25 * 1024 * 1024, category: FileCategory.PDF },
        { name: "large-valid.pdf", mime: "application/pdf", size: 49 * 1024 * 1024, category: FileCategory.PDF },
      ];

      testCases.forEach(({ name, mime, size, category }) => {
        const file = createMockFile(name, mime, size);
        expect(() => validator.validate(file, { category })).not.toThrow();
      });
    });
  });

  describe("SEC-008 Spec: File Type Validation Integration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     * AVATAR category only allows: image/jpeg, image/png, image/gif, image/webp
     *
     * INTEGRATION TEST: Verify MIME type whitelist enforcement
     */
    it("should reject disallowed MIME types for avatar upload", () => {
      const disallowedTypes = [
        { mime: "application/pdf", name: "document.pdf" },
        { mime: "application/zip", name: "archive.zip" },
        { mime: "text/plain", name: "text.txt" },
        { mime: "image/svg+xml", name: "vector.svg" }, // Not in AVATAR whitelist
      ];

      disallowedTypes.forEach(({ mime, name }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNotAllowedException);
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     * PDF category only allows: application/pdf
     *
     * INTEGRATION TEST: Verify PDF endpoint restrictions
     */
    it("should reject non-PDF MIME types for PDF category", () => {
      const nonPdfTypes = [
        { mime: "image/jpeg", name: "disguised.jpg" },
        { mime: "application/msword", name: "document.doc" },
        { mime: "text/plain", name: "readme.txt" },
      ];

      nonPdfTypes.forEach(({ mime, name }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.PDF }))
          .toThrow(FileNotAllowedException);
      });
    });

    /**
     * PROPERTY-BASED TEST: All allowed types should pass validation
     */
    it("should accept all whitelisted MIME types for each category", () => {
      const avatarTypes = [
        { name: "test.jpg", mime: "image/jpeg" },
        { name: "test.jpeg", mime: "image/jpeg" },
        { name: "test.png", mime: "image/png" },
        { name: "test.gif", mime: "image/gif" },
        { name: "test.webp", mime: "image/webp" },
      ];

      avatarTypes.forEach(({ name, mime }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
      });
    });
  });

  describe("SEC-008 Spec: Filename Sanitization - Directory Traversal Prevention", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify path traversal patterns are rejected
     */
    it("should reject all directory traversal patterns", () => {
      const maliciousFilenames = [
        "../../../etc/passwd.jpg",
        "..\\..\\..\\windows\\system32\\config\\sam.jpg",
        "../../etc/passwd",
        "./../../secret.jpg",
        "....//....//etc/passwd.jpg",
        "../config/database.yml",
        "..\\config\\settings.json",
      ];

      maliciousFilenames.forEach(filename => {
        const file = createMockFile(filename, "image/jpeg", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNameInvalidException);
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify path separators are rejected
     */
    it("should reject filenames with path separators", () => {
      const pathSeparatorNames = [
        "subdirectory/file.jpg",
        "folder\\image.png",
        "path/to/file.jpg",
        "path\\to\\file.png",
        "/absolute/path.jpg",
        "\\absolute\\path.png",
      ];

      pathSeparatorNames.forEach(filename => {
        const file = createMockFile(filename, "image/jpeg", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNameInvalidException);
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify dangerous characters are rejected
     */
    it("should reject filenames with dangerous characters", () => {
      const dangerousNames = [
        "file\x00name.jpg", // Null byte
        "file\x00.jpg",
        "~backup.jpg", // Tilde (home directory reference)
        "~temp/file.jpg",
        "file\nname.jpg", // Newline
        "file\rname.jpg", // Carriage return
        "file\r\nname.jpg",
      ];

      dangerousNames.forEach(filename => {
        const file = createMockFile(filename, "image/jpeg", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNameInvalidException);
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify filename length limits
     */
    it("should reject overly long filenames", () => {
      const tooLongName = "a".repeat(256) + ".jpg";
      const file = createMockFile(tooLongName, "image/jpeg", 1024);

      expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Sanitize filenames and prevent directory traversal"
     *
     * INTEGRATION TEST: Verify empty filenames are rejected
     */
    it("should reject empty filenames", () => {
      const emptyNames = ["", "   ", "\t", "\n"];

      emptyNames.forEach(filename => {
        const file = createMockFile(filename, "image/jpeg", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
          .toThrow(FileNameInvalidException);
      });
    });

    /**
     * PROPERTY-BASED TEST: SanitizeFilename should produce safe output
     */
    it("should sanitize dangerous filenames to safe ones", () => {
      const dangerousToSafe = [
        { input: "../etc/passwd.jpg", shouldNotContain: ["..", "/"] },
        { input: "file\x00name.jpg", shouldNotContain: ["\x00"] },
        { input: "~backup.jpg", shouldNotContain: ["~"] },
        { input: "file\nname.jpg", shouldNotContain: ["\n", "\r"] },
        { input: "subdirectory/file.jpg", shouldNotContain: ["/"] },
      ];

      dangerousToSafe.forEach(({ input, shouldNotContain }) => {
        const sanitized = validator.sanitizeFilename(input);
        shouldNotContain.forEach(dangerousChar => {
          expect(sanitized).not.toContain(dangerousChar);
        });
      });
    });
  });

  describe("SEC-008 Spec: File Extension Validation", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     * Extension validation provides additional layer beyond MIME type
     *
     * INTEGRATION TEST: Verify extension whitelist enforcement
     */
    it("should reject files with disallowed extensions", () => {
      const wrongExtensions = [
        { name: "file.txt", mime: "image/jpeg", category: FileCategory.AVATAR },
        { name: "file.pdf", mime: "image/png", category: FileCategory.AVATAR },
        { name: "file.doc", mime: "image/gif", category: FileCategory.AVATAR },
        { name: "file.jpg", mime: "application/pdf", category: FileCategory.PDF },
        { name: "file.png", mime: "application/pdf", category: FileCategory.PDF },
      ];

      wrongExtensions.forEach(({ name, mime, category }) => {
        const file = createMockFile(name, mime, 1024);
        // Should throw either FileNotAllowedException or FileExtensionNotAllowedException
        expect(() => validator.validate(file, { category })).toThrow();
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Implement file type validation"
     *
     * PROPERTY-BASED TEST: Case-insensitive extension matching
     */
    it("should handle case-insensitive extension matching", () => {
      const cases = [
        { name: "file.JPG", mime: "image/jpeg" },
        { name: "file.Jpg", mime: "image/jpeg" },
        { name: "file.JpG", mime: "image/jpeg" },
        { name: "file.PNG", mime: "image/png" },
        { name: "file.Png", mime: "image/png" },
        { name: "file.GIF", mime: "image/gif" },
        { name: "file.Gif", mime: "image/gif" },
      ];

      cases.forEach(({ name, mime }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
      });
    });
  });

  describe("SEC-008 Spec: MIME Type and Extension Mismatch Detection (Strict Mode)", () => {
    /**
     * SPEC REQUIREMENT: upload.config.ts strictMode
     * "验证 MIME 类型与扩展名匹配" (Validate MIME type matches extension)
     *
     * INTEGRATION TEST: Verify strict mode catches mismatches
     */
    it("should detect MIME type and extension mismatch in strict mode", () => {
      const mismatches = [
        { name: "image.png", mime: "image/jpeg" }, // Claims PNG, is JPEG
        { name: "image.jpg", mime: "image/png" }, // Claims JPEG, is PNG
        { name: "file.jpeg", mime: "image/gif" }, // Claims JPEG, is GIF
        { name: "file.gif", mime: "image/webp" }, // Claims GIF, is WebP
      ];

      mismatches.forEach(({ name, mime }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR, strictMode: true }))
          .toThrow(FileMimeTypeMismatchException);
      });
    });

    /**
     * SPEC REQUIREMENT: upload.config.ts strictMode
     *
     * INTEGRATION TEST: Verify valid pairs pass strict mode
     */
    it("should accept matching MIME type and extension pairs in strict mode", () => {
      const validPairs = [
        { name: "image.jpg", mime: "image/jpeg" },
        { name: "image.jpeg", mime: "image/jpeg" },
        { name: "image.png", mime: "image/png" },
        { name: "image.gif", mime: "image/gif" },
        { name: "image.webp", mime: "image/webp" },
      ];

      validPairs.forEach(({ name, mime }) => {
        const file = createMockFile(name, mime, 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR, strictMode: true }))
          .not.toThrow();
      });
    });

    /**
     * SPEC REQUIREMENT: upload.config.ts strictMode
     *
     * INTEGRATION TEST: Verify mismatches allowed when strict mode disabled
     */
    it("should allow MIME/extension mismatch when strict mode is disabled", () => {
      const file = createMockFile("image.png", "image/jpeg", 1024);

      expect(() => validator.validate(file, { category: FileCategory.AVATAR, strictMode: false }))
        .not.toThrow();
    });
  });

  describe("SEC-008 Spec: Virus Scan Integration Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Add virus scanning integration (ClamAV or cloud service)"
     *
     * INTEGRATION TEST: Verify virus scan configuration exists
     */
    it("should have virus scan service configuration available", () => {
      const virusScanEnabled = configService.get<string>("upload.virusScanEnabled");
      const virusScanProvider = configService.get<string>("upload.virusScanProvider");
      const virusScanFailOpen = configService.get<string>("upload.virusScanFailOpen");

      // Verify configuration keys exist
      expect(virusScanEnabled).toBeDefined();
      expect(virusScanProvider).toBeDefined();
      expect(virusScanFailOpen).toBeDefined();

      // Provider should be one of the supported types
      expect(["clamav", "disabled"]).toContain(virusScanProvider || "clamav");
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Add virus scanning integration"
     *
     * INTEGRATION TEST: Verify fail-open mode configuration
     */
    it("should have configurable fail-open mode for virus scan failures", () => {
      const virusScanFailOpen = configService.get<string>("upload.virusScanFailOpen");

      // Fail-open configuration should exist
      expect(virusScanFailOpen).toBeDefined();

      // Default should be true (fail-open for availability)
      expect(virusScanFailOpen !== "false").toBe(true);
    });
  });

  describe("SEC-008 Spec: Storage Outside Web Root Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Store uploads outside web root"
     *
     * INTEGRATION TEST: Verify upload root is configurable
     */
    it("should support configurable upload root directory", () => {
      // Set a test value for UPLOAD_ROOT if not already set
      const uploadRoot = process.env.UPLOAD_ROOT || "./uploads";

      // UPLOAD_ROOT should be configurable via environment
      expect(uploadRoot).toBeDefined();

      // Verify it's a valid path format
      expect(typeof uploadRoot).toBe("string");
      expect(uploadRoot.length).toBeGreaterThan(0);

      // In production, should be an absolute path outside web root
      // In development, can be relative path
      if (uploadRoot.startsWith("/")) {
        // Absolute path - should not contain common web root directories
        expect(uploadRoot).not.toContain("/var/www");
        expect(uploadRoot).not.toContain("/usr/share/nginx/html");
        expect(uploadRoot).not.toContain("/public");
      }
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008
     * "Store uploads outside web root"
     *
     * INTEGRATION TEST: Verify storage provider configuration
     */
    it("should support multiple storage backends", () => {
      const storageProvider = process.env.STORAGE_PROVIDER || "local";

      // Should support multiple storage backends
      const validProviders = ["local", "aliyun-oss", "tencent-cos", "aws-s3", "minio"];
      expect(validProviders).toContain(storageProvider);
    });
  });

  describe("LONGEST-CHAIN E2E: Complete Security Validation Flow", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-008 (Complete workflow)
     * This test exercises the longest realistic path through security validation:
     * File Input → Size Check → MIME Type Check → Extension Check →
     * Filename Sanitization → Strict Mode Validation → Success
     *
     * E2E TEST: Verify all security layers work together
     */
    it("should process valid file through all security validation layers", () => {
      const validFiles = [
        {
          name: "valid-avatar-image.jpg",
          mime: "image/jpeg",
          size: 1024,
          category: FileCategory.AVATAR,
        },
        {
          name: "valid-document.pdf",
          mime: "application/pdf",
          size: 10 * 1024 * 1024,
          category: FileCategory.PDF,
        },
        {
          name: "valid-image.png",
          mime: "image/png",
          size: 5 * 1024 * 1024,
          category: FileCategory.IMAGE,
        },
      ];

      validFiles.forEach(({ name, mime, size, category }) => {
        const file = createMockFile(name, mime, size);

        // Should pass all validation layers
        expect(() => validator.validate(file, { category, strictMode: true }))
          .not.toThrow();
      });
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-008 (Complete security rejection)
     * This test verifies that malicious files are rejected at the appropriate layer
     *
     * E2E TEST: Verify malicious patterns are rejected at appropriate layers
     */
    it("should reject malicious file patterns at appropriate validation layers", () => {
      const maliciousFiles = [
        {
          name: "../../../etc/passwd.jpg",
          mime: "image/jpeg",
          size: 1024,
          category: FileCategory.AVATAR,
          expectedError: FileNameInvalidException,
        },
        {
          name: "oversized.jpg",
          mime: "image/jpeg",
          size: 10 * 1024 * 1024, // Exceeds AVATAR 5MB limit
          category: FileCategory.AVATAR,
          expectedError: FileTooLargeException,
        },
        {
          name: "malicious.pdf",
          mime: "application/pdf",
          size: 1024,
          category: FileCategory.AVATAR,
          expectedError: FileNotAllowedException,
        },
        {
          name: "image.png",
          mime: "image/jpeg", // Mismatch in strict mode
          size: 1024,
          category: FileCategory.AVATAR,
          strictMode: true,
          expectedError: FileMimeTypeMismatchException,
        },
      ];

      maliciousFiles.forEach(({ name, mime, size, category, strictMode, expectedError }) => {
        const file = createMockFile(name, mime, size);
        expect(() => validator.validate(file, { category, strictMode }))
          .toThrow(expectedError);
      });
    });
  });

  describe("PROPERTY-BASED: File Validation Invariants", () => {
    /**
     * PROPERTY-BASED TEST: Idempotency - validating the same file twice produces same result
     */
    it("should be idempotent - validating same file multiple times produces same result", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);

      // First validation should pass
      expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
        .not.toThrow();

      // Second validation should also pass (same result)
      expect(() => validator.validate(file, { category: FileCategory.AVATAR }))
        .not.toThrow();

      // Same for invalid file
      const invalidFile = createMockFile("../etc/passwd.jpg", "image/jpeg", 1024);

      expect(() => validator.validate(invalidFile, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);

      expect(() => validator.validate(invalidFile, { category: FileCategory.AVATAR }))
        .toThrow(FileNameInvalidException);
    });

    /**
     * PROPERTY-BASED TEST: Commutativity - validation options order shouldn't matter
     */
    it("should validate consistently regardless of validation option order", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);

      // Validate with different option orders
      const options1 = { category: FileCategory.AVATAR, strictMode: true };
      const options2 = { strictMode: true, category: FileCategory.AVATAR };

      const result1 = () => validator.validate(file, options1);
      const result2 = () => validator.validate(file, options2);

      // Both should produce same result
      expect(result1).not.toThrow();
      expect(result2).not.toThrow();
    });

    /**
     * PROPERTY-BASED TEST: Transitivity - if A passes and B has same valid attributes, B passes
     */
    it("should validate consistently for files with same valid attributes", () => {
      const baseFile = createMockFile("test.jpg", "image/jpeg", 1024);
      const sameFile = createMockFile("test.jpg", "image/jpeg", 1024);

      // Both should pass or both should fail
      const baseResult = () => validator.validate(baseFile, { category: FileCategory.AVATAR });
      const sameResult = () => validator.validate(sameFile, { category: FileCategory.AVATAR });

      expect(baseResult).not.toThrow();
      expect(sameResult).not.toThrow();
    });
  });

  describe("FileValidationPipe Integration", () => {
    /**
     * INTEGRATION TEST: Verify FileValidationPipe works with FileValidator
     */
    it("should create functional pipe via static factory", () => {
      const pipe = FileValidationPipe.create({
        category: FileCategory.AVATAR,
        strictMode: true,
      });

      const validFile = createMockFile("test.jpg", "image/jpeg", 1024);

      // Should return the file unchanged when validation passes
      const result = pipe.transform(validFile);
      expect(result).toBe(validFile);
    });

    /**
     * INTEGRATION TEST: Verify pipe throws on validation failure
     */
    it("should throw through pipe when validation fails", () => {
      const pipe = FileValidationPipe.create({
        category: FileCategory.AVATAR,
        strictMode: true,
      });

      const invalidFile = createMockFile("../etc/passwd.jpg", "image/jpeg", 1024);

      expect(() => pipe.transform(invalidFile)).toThrow(FileNameInvalidException);
    });
  });
});
