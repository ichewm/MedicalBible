/**
 * @file 文件上传配置单元测试
 * @description 测试文件上传配置的各种场景，包括文件分类、大小限制、MIME 类型白名单等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { uploadConfig, FileCategory, getFileCategoryConfig, ALLOWED_FILE_TYPES, FILE_SIZE_LIMITS, FILE_EXTENSIONS } from "./upload.config";

describe("UploadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPLOAD_MAX_SIZE;
    delete process.env.UPLOAD_STRICT_MODE;
    delete process.env.UPLOAD_VIRUS_SCAN_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SPEC: 默认配置值", () => {
    it("should use default global max size when UPLOAD_MAX_SIZE is not set", () => {
      delete process.env.UPLOAD_MAX_SIZE;
      const config = uploadConfig();
      expect(config.globalMaxSize).toBe(50 * 1024 * 1024); // 50MB
    });

    it("should enable strict mode by default", () => {
      delete process.env.UPLOAD_STRICT_MODE;
      const config = uploadConfig();
      expect(config.strictMode).toBe(true);
    });

    it("should disable virus scan by default", () => {
      delete process.env.UPLOAD_VIRUS_SCAN_ENABLED;
      const config = uploadConfig();
      expect(config.virusScanEnabled).toBe(false);
    });
  });

  describe("SPEC: 环境变量配置", () => {
    it("should parse UPLOAD_MAX_SIZE from environment variable", () => {
      process.env.UPLOAD_MAX_SIZE = "10485760"; // 10MB
      const config = uploadConfig();
      expect(config.globalMaxSize).toBe(10485760);
    });

    it("should enable strict mode when UPLOAD_STRICT_MODE is not 'false'", () => {
      process.env.UPLOAD_STRICT_MODE = "true";
      const config = uploadConfig();
      expect(config.strictMode).toBe(true);
    });

    it("should disable strict mode when UPLOAD_STRICT_MODE is 'false'", () => {
      process.env.UPLOAD_STRICT_MODE = "false";
      const config = uploadConfig();
      expect(config.strictMode).toBe(false);
    });

    it("should enable virus scan when UPLOAD_VIRUS_SCAN_ENABLED is 'true'", () => {
      process.env.UPLOAD_VIRUS_SCAN_ENABLED = "true";
      const config = uploadConfig();
      expect(config.virusScanEnabled).toBe(true);
    });

    it("should not enable virus scan for other values", () => {
      process.env.UPLOAD_VIRUS_SCAN_ENABLED = "yes";
      const config = uploadConfig();
      expect(config.virusScanEnabled).toBe(false);
    });
  });

  describe("SPEC: FileCategory 枚举", () => {
    it("should have AVATAR category", () => {
      expect(FileCategory.AVATAR).toBe("avatar");
    });

    it("should have PDF category", () => {
      expect(FileCategory.PDF).toBe("pdf");
    });

    it("should have IMAGE category", () => {
      expect(FileCategory.IMAGE).toBe("image");
    });

    it("should have DOCUMENT category", () => {
      expect(FileCategory.DOCUMENT).toBe("document");
    });

    it("should have GENERAL category", () => {
      expect(FileCategory.GENERAL).toBe("general");
    });
  });

  describe("SPEC: 文件大小限制配置", () => {
    it("should set AVATAR max size to 5MB", () => {
      expect(FILE_SIZE_LIMITS[FileCategory.AVATAR]).toBe(5 * 1024 * 1024);
    });

    it("should set PDF max size to 50MB", () => {
      expect(FILE_SIZE_LIMITS[FileCategory.PDF]).toBe(50 * 1024 * 1024);
    });

    it("should set IMAGE max size to 10MB", () => {
      expect(FILE_SIZE_LIMITS[FileCategory.IMAGE]).toBe(10 * 1024 * 1024);
    });

    it("should set DOCUMENT max size to 20MB", () => {
      expect(FILE_SIZE_LIMITS[FileCategory.DOCUMENT]).toBe(20 * 1024 * 1024);
    });

    it("should set GENERAL max size to 20MB", () => {
      expect(FILE_SIZE_LIMITS[FileCategory.GENERAL]).toBe(20 * 1024 * 1024);
    });
  });

  describe("SPEC: MIME 类型白名单配置", () => {
    describe("AVATAR category", () => {
      it("should allow JPEG images", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).toContain("image/jpeg");
      });

      it("should allow PNG images", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).toContain("image/png");
      });

      it("should allow GIF images", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).toContain("image/gif");
      });

      it("should allow WebP images", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).toContain("image/webp");
      });

      it("should not allow SVG in AVATAR", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).not.toContain("image/svg+xml");
      });

      it("should not allow PDF in AVATAR", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.AVATAR]).not.toContain("application/pdf");
      });
    });

    describe("PDF category", () => {
      it("should only allow PDF files", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.PDF]).toEqual(["application/pdf"]);
      });
    });

    describe("IMAGE category", () => {
      it("should allow SVG images", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.IMAGE]).toContain("image/svg+xml");
      });

      it("should allow JPEG, PNG, GIF, WebP", () => {
        const types = ALLOWED_FILE_TYPES[FileCategory.IMAGE];
        expect(types).toContain("image/jpeg");
        expect(types).toContain("image/png");
        expect(types).toContain("image/gif");
        expect(types).toContain("image/webp");
      });
    });

    describe("DOCUMENT category", () => {
      it("should allow PDF files", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain("application/pdf");
      });

      it("should allow Word documents (.doc)", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain("application/msword");
      });

      it("should allow Word documents (.docx)", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      });

      it("should allow Excel files", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain(
          "application/vnd.ms-excel",
        );
      });

      it("should allow Excel files (.xlsx)", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      });

      it("should allow PowerPoint files", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain(
          "application/vnd.ms-powerpoint",
        );
      });

      it("should allow PowerPoint files (.pptx)", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain(
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        );
      });

      it("should allow plain text files", () => {
        expect(ALLOWED_FILE_TYPES[FileCategory.DOCUMENT]).toContain("text/plain");
      });
    });
  });

  describe("SPEC: 文件扩展名白名单配置", () => {
    describe("AVATAR category", () => {
      it("should allow .jpg and .jpeg extensions", () => {
        const exts = FILE_EXTENSIONS[FileCategory.AVATAR];
        expect(exts).toContain(".jpg");
        expect(exts).toContain(".jpeg");
      });

      it("should allow .png, .gif, .webp extensions", () => {
        const exts = FILE_EXTENSIONS[FileCategory.AVATAR];
        expect(exts).toContain(".png");
        expect(exts).toContain(".gif");
        expect(exts).toContain(".webp");
      });

      it("should not allow .svg in AVATAR", () => {
        expect(FILE_EXTENSIONS[FileCategory.AVATAR]).not.toContain(".svg");
      });
    });

    describe("PDF category", () => {
      it("should only allow .pdf extension", () => {
        expect(FILE_EXTENSIONS[FileCategory.PDF]).toEqual([".pdf"]);
      });
    });

    describe("IMAGE category", () => {
      it("should allow .svg extension", () => {
        expect(FILE_EXTENSIONS[FileCategory.IMAGE]).toContain(".svg");
      });
    });

    describe("DOCUMENT category", () => {
      it("should allow .doc and .docx extensions", () => {
        const exts = FILE_EXTENSIONS[FileCategory.DOCUMENT];
        expect(exts).toContain(".doc");
        expect(exts).toContain(".docx");
      });

      it("should allow .xls and .xlsx extensions", () => {
        const exts = FILE_EXTENSIONS[FileCategory.DOCUMENT];
        expect(exts).toContain(".xls");
        expect(exts).toContain(".xlsx");
      });

      it("should allow .ppt and .pptx extensions", () => {
        const exts = FILE_EXTENSIONS[FileCategory.DOCUMENT];
        expect(exts).toContain(".ppt");
        expect(exts).toContain(".pptx");
      });

      it("should allow .txt extension", () => {
        expect(FILE_EXTENSIONS[FileCategory.DOCUMENT]).toContain(".txt");
      });
    });

    describe("GENERAL category", () => {
      it("should allow .zip extension", () => {
        expect(FILE_EXTENSIONS[FileCategory.GENERAL]).toContain(".zip");
      });

      it("should include all document extensions", () => {
        const generalExts = FILE_EXTENSIONS[FileCategory.GENERAL];
        const docExts = FILE_EXTENSIONS[FileCategory.DOCUMENT];
        docExts.forEach((ext) => {
          expect(generalExts).toContain(ext);
        });
      });
    });
  });

  describe("SPEC: getFileCategoryConfig 函数", () => {
    it("should return correct config for AVATAR category", () => {
      const config = getFileCategoryConfig(FileCategory.AVATAR);
      expect(config.allowedMimeTypes).toContain("image/jpeg");
      expect(config.allowedMimeTypes).toContain("image/png");
      expect(config.maxSize).toBe(5 * 1024 * 1024);
      expect(config.allowedExtensions).toContain(".jpg");
      expect(config.allowedExtensions).toContain(".png");
    });

    it("should return correct config for PDF category", () => {
      const config = getFileCategoryConfig(FileCategory.PDF);
      expect(config.allowedMimeTypes).toEqual(["application/pdf"]);
      expect(config.maxSize).toBe(50 * 1024 * 1024);
      expect(config.allowedExtensions).toEqual([".pdf"]);
    });

    it("should return config object with all required properties", () => {
      const config = getFileCategoryConfig(FileCategory.IMAGE);
      expect(config).toHaveProperty("allowedMimeTypes");
      expect(config).toHaveProperty("maxSize");
      expect(config).toHaveProperty("allowedExtensions");
      expect(Array.isArray(config.allowedMimeTypes)).toBe(true);
      expect(Array.isArray(config.allowedExtensions)).toBe(true);
      expect(typeof config.maxSize).toBe("number");
    });
  });

  describe("SPEC: 完整配置对象结构", () => {
    it("should provide complete configuration object", () => {
      process.env.UPLOAD_MAX_SIZE = "52428800";
      process.env.UPLOAD_STRICT_MODE = "true";
      process.env.UPLOAD_VIRUS_SCAN_ENABLED = "false";

      const config = uploadConfig();

      expect(config).toHaveProperty("globalMaxSize");
      expect(config).toHaveProperty("strictMode");
      expect(config).toHaveProperty("virusScanEnabled");
      expect(config).toHaveProperty("allowedMimeTypes");
      expect(config).toHaveProperty("fileSizeLimits");
      expect(config).toHaveProperty("allowedExtensions");
    });

    it("should include nested category configurations", () => {
      const config = uploadConfig();

      expect(config.allowedMimeTypes).toHaveProperty(FileCategory.AVATAR);
      expect(config.allowedMimeTypes).toHaveProperty(FileCategory.PDF);
      expect(config.fileSizeLimits).toHaveProperty(FileCategory.AVATAR);
      expect(config.allowedExtensions).toHaveProperty(FileCategory.AVATAR);
    });
  });

  describe("SPEC: MIME 类型常量", () => {
    it("should define image MIME types", () => {
      const { MimeTypes } = require("./upload.config");
      expect(MimeTypes.IMAGE_JPEG).toBe("image/jpeg");
      expect(MimeTypes.IMAGE_PNG).toBe("image/png");
      expect(MimeTypes.IMAGE_GIF).toBe("image/gif");
      expect(MimeTypes.IMAGE_WEBP).toBe("image/webp");
      expect(MimeTypes.IMAGE_SVG).toBe("image/svg+xml");
    });

    it("should define document MIME types", () => {
      const { MimeTypes } = require("./upload.config");
      expect(MimeTypes.PDF).toBe("application/pdf");
      expect(MimeTypes.MS_WORD).toBe("application/msword");
      expect(MimeTypes.MS_EXCEL).toBe("application/vnd.ms-excel");
    });
  });
});
