/**
 * @file 错误响应 DTO 单元测试
 * @description 测试错误响应 DTO 的结构和属性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ErrorResponseDto } from "./error-response.dto";
import { ValidationErrorDto } from "./validation-error.dto";

describe("ErrorResponseDto", () => {
  describe("基本属性", () => {
    it("应包含所有必需的属性", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "验证失败",
        path: "/api/auth/login",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(400);
      expect(errorResponse.message).toBe("验证失败");
      expect(errorResponse.path).toBe("/api/auth/login");
      expect(errorResponse.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });

    it("应包含可选的 errorCode 属性", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "验证失败",
        path: "/api/auth/login",
        timestamp: "2024-01-15T10:30:00.000Z",
        errorCode: "ERR_1001",
      };

      expect(errorResponse.errorCode).toBe("ERR_1001");
    });

    it("应包含可选的 error 属性（开发环境）", () => {
      const errorResponse: ErrorResponseDto = {
        code: 500,
        message: "服务器内部错误",
        path: "/api/data",
        timestamp: "2024-01-15T10:30:00.000Z",
        error: "Database connection failed",
      };

      expect(errorResponse.error).toBe("Database connection failed");
    });

    it("应包含可选的 requestId 属性", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "验证失败",
        path: "/api/auth/login",
        timestamp: "2024-01-15T10:30:00.000Z",
        requestId: "req-abc123xyz",
      };

      expect(errorResponse.requestId).toBe("req-abc123xyz");
    });
  });

  describe("完整的错误响应", () => {
    it("应支持所有属性同时存在", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        errorCode: "ERR_1001",
        message: "验证失败，请检查输入",
        error: "Field 'email' must be a valid email address",
        path: "/api/auth/login",
        requestId: "req-abc123xyz",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse).toEqual({
        code: 400,
        errorCode: "ERR_1001",
        message: "验证失败，请检查输入",
        error: "Field 'email' must be a valid email address",
        path: "/api/auth/login",
        requestId: "req-abc123xyz",
        timestamp: "2024-01-15T10:30:00.000Z",
      });
    });
  });

  describe("常见 HTTP 状态码", () => {
    it("应支持 400 Bad Request", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "请求参数错误",
        path: "/api/test",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(400);
    });

    it("应支持 401 Unauthorized", () => {
      const errorResponse: ErrorResponseDto = {
        code: 401,
        message: "请先登录",
        errorCode: "ERR_1100",
        path: "/api/protected",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(401);
      expect(errorResponse.errorCode).toBe("ERR_1100");
    });

    it("应支持 403 Forbidden", () => {
      const errorResponse: ErrorResponseDto = {
        code: 403,
        message: "无权限访问",
        errorCode: "ERR_1400",
        path: "/api/admin",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(403);
    });

    it("应支持 404 Not Found", () => {
      const errorResponse: ErrorResponseDto = {
        code: 404,
        message: "请求的资源不存在",
        errorCode: "ERR_1002",
        path: "/api/users/999",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(404);
    });

    it("应支持 500 Internal Server Error", () => {
      const errorResponse: ErrorResponseDto = {
        code: 500,
        message: "服务器内部错误",
        errorCode: "ERR_1000",
        path: "/api/test",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(500);
    });

    it("应支持 503 Service Unavailable", () => {
      const errorResponse: ErrorResponseDto = {
        code: 503,
        message: "服务暂时不可用",
        errorCode: "ERR_1904",
        path: "/api/test",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.code).toBe(503);
    });
  });

  describe("时间戳格式", () => {
    it("应接受 ISO 8601 格式的时间戳", () => {
      const timestamps = [
        "2024-01-15T10:30:00.000Z",
        "2024-01-15T10:30:00Z",
        "2024-01-15T10:30:00.123Z",
        "2024-12-31T23:59:59.999Z",
      ];

      timestamps.forEach((timestamp) => {
        const errorResponse: ErrorResponseDto = {
          code: 400,
          message: "测试",
          path: "/api/test",
          timestamp,
        };

        expect(new Date(errorResponse.timestamp).getTime()).not.toBeNaN();
      });
    });

    it("应支持从 Date 对象生成时间戳", () => {
      const date = new Date();
      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "测试",
        path: "/api/test",
        timestamp: date.toISOString(),
      };

      expect(errorResponse.timestamp).toBe(date.toISOString());
    });
  });

  describe("验证错误详情", () => {
    it("应包含可选的 validationErrors 属性", () => {
      const validationErrors: ValidationErrorDto[] = [
        {
          field: "email",
          message: "邮箱格式不正确",
          constraint: "isEmail",
        },
        {
          field: "password",
          message: "密码长度不能少于8位",
          constraint: "minLength",
        },
      ];

      const errorResponse: ErrorResponseDto = {
        code: 400,
        message: "验证失败，请检查输入",
        path: "/api/auth/login",
        timestamp: "2024-01-15T10:30:00.000Z",
        validationErrors,
      };

      expect(errorResponse.validationErrors).toEqual(validationErrors);
      expect(errorResponse.validationErrors).toHaveLength(2);
    });

    it("应支持没有验证错误的响应", () => {
      const errorResponse: ErrorResponseDto = {
        code: 500,
        message: "服务器内部错误",
        path: "/api/test",
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(errorResponse.validationErrors).toBeUndefined();
    });

    it("应支持带验证错误的完整错误响应", () => {
      const errorResponse: ErrorResponseDto = {
        code: 400,
        errorCode: "ERR_1001",
        message: "验证失败，请检查输入",
        path: "/api/auth/login",
        requestId: "req-abc123xyz",
        timestamp: "2024-01-15T10:30:00.000Z",
        validationErrors: [
          {
            field: "email",
            message: "邮箱格式不正确",
            constraint: "isEmail",
          },
        ],
      };

      expect(errorResponse.validationErrors).toBeDefined();
      expect(errorResponse.validationErrors).toHaveLength(1);
      expect(errorResponse.validationErrors?.[0].field).toBe("email");
    });
  });
});
