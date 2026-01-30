/**
 * @file 全局异常过滤器单元测试
 * @description 测试异常过滤器对各种异常的处理
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { HttpException, HttpStatus, ArgumentsHost } from "@nestjs/common";
import { GlobalExceptionFilter, ErrorResponse } from "./http-exception.filter";
import {
  BusinessException,
  ErrorCode,
  ResourceNotFoundException,
} from "../exceptions/business.exception";
import { QueryFailedError, EntityNotFoundError } from "typeorm";

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    // 保存原始 NODE_ENV
    process.env.NODE_ENV = "test";

    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: "/api/v1/test",
      method: "GET",
      headers: {
        "x-request-id": "test-request-id",
      },
      get: jest.fn(),
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HTTP 异常处理", () => {
    it("应正确处理 HttpException", () => {
      const exception = new HttpException("资源不存在", HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.NOT_FOUND,
          message: "资源不存在",
          path: "/api/v1/test",
          requestId: "test-request-id",
        }),
      );
    });

    it("应处理带对象响应的 HttpException", () => {
      const exception = new HttpException(
        { message: "参数错误", error: "Bad Request" },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.BAD_REQUEST,
          message: "参数错误",
        }),
      );
    });

    it("应处理带数组消息的 HttpException", () => {
      const exception = new HttpException(
        { message: ["字段1错误", "字段2错误"] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "字段1错误, 字段2错误",
        }),
      );
    });
  });

  describe("业务异常处理", () => {
    it("应正确处理 BusinessException", () => {
      const exception = new BusinessException(
        "业务错误",
        ErrorCode.OPERATION_FAILED,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.BAD_REQUEST,
          message: "业务错误",
          errorCode: ErrorCode.OPERATION_FAILED,
        }),
      );
    });

    it("应正确处理 ResourceNotFoundException", () => {
      const exception = new ResourceNotFoundException("用户", 123);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.NOT_FOUND,
          message: "用户 (ID: 123) 不存在",
          errorCode: ErrorCode.RESOURCE_NOT_FOUND,
        }),
      );
    });
  });

  describe("数据库异常处理", () => {
    it("应处理唯一约束冲突", () => {
      const exception = new QueryFailedError(
        "INSERT INTO users",
        [],
        new Error("Duplicate entry 'test' for key 'phone'"),
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "数据已存在，请勿重复提交",
          errorCode: ErrorCode.DATABASE_ERROR,
        }),
      );
    });

    it("应处理外键约束错误", () => {
      const exception = new QueryFailedError(
        "DELETE FROM categories",
        [],
        new Error(
          "Cannot delete or update a parent row: a foreign key constraint fails",
        ),
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "关联数据不存在或无法删除",
        }),
      );
    });

    it("应处理数据过长错误", () => {
      const exception = new QueryFailedError(
        "INSERT INTO users",
        [],
        new Error("Data too long for column 'name'"),
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "输入内容过长",
        }),
      );
    });

    it("应处理数据库连接错误", () => {
      const exception = new QueryFailedError(
        "SELECT * FROM users",
        [],
        new Error("ECONNREFUSED"),
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "数据库连接失败，请稍后重试",
        }),
      );
    });

    it("应处理 EntityNotFoundError", () => {
      const exception = new EntityNotFoundError("User", { id: 1 });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "请求的资源不存在",
          errorCode: ErrorCode.RESOURCE_NOT_FOUND,
        }),
      );
    });
  });

  describe("通用错误处理", () => {
    it("应处理普通 Error", () => {
      const exception = new Error("未知错误");

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "服务器内部错误",
          errorCode: ErrorCode.UNKNOWN_ERROR,
        }),
      );
    });

    it("应处理超时错误", () => {
      const exception = new Error("Request timed out");
      exception.name = "TimeoutError";

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.GATEWAY_TIMEOUT,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "请求超时，请稍后重试",
        }),
      );
    });

    it("应处理未知类型异常", () => {
      filter.catch("unknown exception", mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "未知错误",
        }),
      );
    });
  });

  describe("请求 ID 追踪", () => {
    it("应在响应中包含请求 ID", () => {
      const exception = new HttpException("测试", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "test-request-id",
        }),
      );
    });

    it("应处理没有请求 ID 的情况", () => {
      mockRequest.headers = {};
      const exception = new HttpException("测试", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(response.requestId).toBeUndefined();
    });
  });

  describe("时间戳", () => {
    it("应在响应中包含时间戳", () => {
      const exception = new HttpException("测试", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe("开发环境错误详情", () => {
    it("开发环境应显示错误详情", () => {
      process.env.NODE_ENV = "development";
      // 重新创建 filter 以应用新的 NODE_ENV
      filter = new GlobalExceptionFilter();

      const exception = new Error("详细错误信息");

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBeDefined();
    });
  });
});
