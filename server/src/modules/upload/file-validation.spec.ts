/**
 * @file 文件验证单元测试
 * @description 测试文件验证的各种场景，包括大小限制、类型验证、扩展名检查等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FileValidator, FileValidationPipe } from "./file-validation";
import { FileCategory } from "@config/upload.config";
import {
  FileTooLargeException,
  FileNotAllowedException,
  FileExtensionNotAllowedException,
  FileNotProvidedException,
  FileNameInvalidException,
  FileMimeTypeMismatchException,
} from "@common/exceptions/business.exception";

describe("FileValidator", () => {
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

  describe("SPEC: 文件存在性验证", () => {
    it("should throw FileNotProvidedException when file is null", () => {
      expect(() => validator.validate(null as any)).toThrow(FileNotProvidedException);
    });

    it("should throw FileNotProvidedException when file is undefined", () => {
      expect(() => validator.validate(undefined as any)).toThrow(FileNotProvidedException);
    });

    it("should accept a valid file", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });
  });

  describe("SPEC: 文件名验证", () => {
    it("should reject empty filename", () => {
      const file = createMockFile("", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with path traversal (..)", () => {
      const file = createMockFile("../etc/passwd", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with forward slash", () => {
      const file = createMockFile("test/file.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with backslash", () => {
      const file = createMockFile("test\\file.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with null byte", () => {
      const file = createMockFile("test\x00file.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with tilde", () => {
      const file = createMockFile("~test.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename with newline character", () => {
      const file = createMockFile("test\nfile.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should reject filename longer than 255 characters", () => {
      const longName = "a".repeat(256) + ".jpg";
      const file = createMockFile(longName, "image/jpeg", 1024);
      expect(() => validator.validate(file)).toThrow(FileNameInvalidException);
    });

    it("should accept valid filename", () => {
      const file = createMockFile("valid-file_name.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });
  });

  describe("SPEC: 文件大小验证", () => {
    it("should accept file within size limit", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 5 * 1024 * 1024); // 5MB
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should reject file exceeding AVATAR size limit (5MB)", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 5 * 1024 * 1024 + 1);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).toThrow(FileTooLargeException);
    });

    it("should reject file exceeding PDF size limit (50MB)", () => {
      const file = createMockFile("test.pdf", "application/pdf", 50 * 1024 * 1024 + 1);
      expect(() => validator.validate(file, { category: FileCategory.PDF })).toThrow(FileTooLargeException);
    });

    it("should reject file exceeding custom size limit", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024 * 1024 + 1);
      expect(() => validator.validate(file, { maxSize: 1024 * 1024 })).toThrow(FileTooLargeException);
    });

    it("should include correct size information in error message", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 10 * 1024 * 1024);
      try {
        validator.validate(file, { maxSize: 5 * 1024 * 1024 });
        fail("Should have thrown FileTooLargeException");
      } catch (error) {
        expect(error).toBeInstanceOf(FileTooLargeException);
        expect(error.message).toContain("5.0");
        expect(error.message).toContain("10.0");
      }
    });
  });

  describe("SPEC: MIME 类型验证", () => {
    it("should accept allowed MIME type", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(() =>
        validator.validate(file, {
          allowedMimeTypes: ["image/jpeg", "image/png"],
        }),
      ).not.toThrow();
    });

    it("should reject disallowed MIME type", () => {
      const file = createMockFile("test.gif", "image/gif", 1024);
      expect(() =>
        validator.validate(file, {
          allowedMimeTypes: ["image/jpeg", "image/png"],
        }),
      ).toThrow(FileNotAllowedException);
    });

    it("should use category MIME types when category is specified", () => {
      const file = createMockFile("test.gif", "image/gif", 1024);
      // AVATAR category allows gif
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should reject MIME type not in category whitelist", () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      // AVATAR category does not allow PDF
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).toThrow(
        FileNotAllowedException,
      );
    });

    it("should skip MIME type validation when no restrictions are set", () => {
      const file = createMockFile("test.unknown", "application/unknown", 1024);
      expect(() => validator.validate(file, {})).not.toThrow();
    });

    it("should prioritize allowedMimeTypes over category", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      // Even though AVATAR allows JPEG, custom list overrides
      expect(() =>
        validator.validate(file, {
          category: FileCategory.AVATAR,
          allowedMimeTypes: ["image/png"],
        }),
      ).toThrow(FileNotAllowedException);
    });
  });

  describe("SPEC: 文件扩展名验证", () => {
    it("should accept allowed extension", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(() =>
        validator.validate(file, {
          allowedExtensions: [".jpg", ".jpeg", ".png"],
        }),
      ).not.toThrow();
    });

    it("should reject disallowed extension", () => {
      const file = createMockFile("test.gif", "image/gif", 1024);
      expect(() =>
        validator.validate(file, {
          allowedExtensions: [".jpg", ".jpeg", ".png"],
        }),
      ).toThrow(FileExtensionNotAllowedException);
    });

    it("should handle case insensitive extension matching", () => {
      const file = createMockFile("test.JPG", "image/jpeg", 1024);
      expect(() =>
        validator.validate(file, {
          allowedExtensions: [".jpg"],
        }),
      ).not.toThrow();
    });

    it("should handle files without extension", () => {
      const file = createMockFile("test", "image/jpeg", 1024);
      expect(() =>
        validator.validate(file, {
          allowedExtensions: [".jpg"],
        }),
      ).toThrow(FileExtensionNotAllowedException);
    });

    it("should use category extensions when category is specified", () => {
      const file = createMockFile("test.webp", "image/webp", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should prioritize allowedExtensions over category", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(() =>
        validator.validate(file, {
          category: FileCategory.AVATAR,
          allowedExtensions: [".png"],
        }),
      ).toThrow(FileExtensionNotAllowedException);
    });
  });

  describe("SPEC: MIME 类型与扩展名匹配验证（严格模式）", () => {
    it("should accept matching MIME type and extension", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should accept PNG with .png extension", () => {
      const file = createMockFile("test.png", "image/png", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should accept JPEG with .jpeg extension", () => {
      const file = createMockFile("test.jpeg", "image/jpeg", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
    });

    it("should reject mismatched MIME type and extension", () => {
      const file = createMockFile("test.jpg", "image/png", 1024);
      expect(() => validator.validate(file, { category: FileCategory.AVATAR })).toThrow(
        FileMimeTypeMismatchException,
      );
    });

    it("should reject PDF with wrong extension", () => {
      // PDF category only allows .pdf extension, so it should fail extension validation
      const file = createMockFile("test.jpg", "application/pdf", 1024);
      expect(() => validator.validate(file, { category: FileCategory.PDF })).toThrow(
        FileExtensionNotAllowedException,
      );
    });

    it("should allow skipping strict mode", () => {
      const file = createMockFile("test.jpg", "image/png", 1024);
      expect(() =>
        validator.validate(file, {
          category: FileCategory.AVATAR,
          strictMode: false,
        }),
      ).not.toThrow();
    });

    it("should handle unknown MIME types gracefully", () => {
      const file = createMockFile("test.unknown", "application/x-unknown", 1024);
      expect(() =>
        validator.validate(file, {
          allowedMimeTypes: ["application/x-unknown"],
          allowedExtensions: [".unknown"],
        }),
      ).not.toThrow();
    });

    it("should respect global strict mode setting", () => {
      const file = createMockFile("test.jpg", "image/png", 1024);
      // Mock config service returns strictMode: true by default
      expect(() =>
        validator.validate(file, {
          allowedMimeTypes: ["image/png"],
          allowedExtensions: [".jpg"],
        }),
      ).toThrow(FileMimeTypeMismatchException);
    });
  });

  describe("SPEC: 文件分类预设配置", () => {
    describe("AVATAR category", () => {
      const maxSize = 5 * 1024 * 1024; // 5MB

      it("should accept valid avatar image", () => {
        const file = createMockFile("avatar.jpg", "image/jpeg", maxSize - 1);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).not.toThrow();
      });

      it("should reject avatar exceeding size limit", () => {
        const file = createMockFile("avatar.jpg", "image/jpeg", maxSize + 1);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).toThrow(
          FileTooLargeException,
        );
      });

      it("should reject unsupported MIME type for avatar", () => {
        const file = createMockFile("avatar.pdf", "application/pdf", 1024);
        expect(() => validator.validate(file, { category: FileCategory.AVATAR })).toThrow(
          FileNotAllowedException,
        );
      });
    });

    describe("PDF category", () => {
      const maxSize = 50 * 1024 * 1024; // 50MB

      it("should accept valid PDF file", () => {
        const file = createMockFile("document.pdf", "application/pdf", maxSize - 1);
        expect(() => validator.validate(file, { category: FileCategory.PDF })).not.toThrow();
      });

      it("should reject PDF exceeding size limit", () => {
        const file = createMockFile("document.pdf", "application/pdf", maxSize + 1);
        expect(() => validator.validate(file, { category: FileCategory.PDF })).toThrow(
          FileTooLargeException,
        );
      });
    });

    describe("IMAGE category", () => {
      const maxSize = 10 * 1024 * 1024; // 10MB

      it("should accept SVG images", () => {
        const file = createMockFile("image.svg", "image/svg+xml", 1024);
        expect(() => validator.validate(file, { category: FileCategory.IMAGE })).not.toThrow();
      });
    });

    describe("DOCUMENT category", () => {
      it("should accept Word documents (.doc)", () => {
        const file = createMockFile("doc.doc", "application/msword", 1024);
        expect(() => validator.validate(file, { category: FileCategory.DOCUMENT })).not.toThrow();
      });

      it("should accept Word documents (.docx)", () => {
        const file = createMockFile(
          "doc.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          1024,
        );
        expect(() => validator.validate(file, { category: FileCategory.DOCUMENT })).not.toThrow();
      });
    });
  });

  describe("SPEC: sanitizeFilename", () => {
    it("should remove dangerous characters from filename", () => {
      const sanitized = validator.sanitizeFilename("../etc/passwd.jpg");
      expect(sanitized).not.toContain("..");
      expect(sanitized).not.toContain("/");
      expect(sanitized).toContain("_");
    });

    it("should truncate long filenames", () => {
      const longName = "a".repeat(300) + ".jpg";
      const sanitized = validator.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it("should preserve file extension", () => {
      const sanitized = validator.sanitizeFilename("test.jpg");
      expect(sanitized).toContain(".jpg");
    });
  });

  describe("SPEC: FileValidationPipe", () => {
    it("should return the file when validation passes", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      const pipe = FileValidationPipe.create({
        allowedMimeTypes: ["image/jpeg"],
      });
      const result = pipe.transform(file);
      expect(result).toBe(file);
    });

    it("should throw when validation fails", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1024);
      const pipe = FileValidationPipe.create({
        allowedMimeTypes: ["image/png"],
      });
      expect(() => pipe.transform(file)).toThrow(FileNotAllowedException);
    });
  });
});
