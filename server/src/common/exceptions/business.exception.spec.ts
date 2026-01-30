/**
 * @file 业务异常类单元测试
 * @description 测试各种业务异常的行为
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { HttpStatus } from "@nestjs/common";
import {
  BusinessException,
  ErrorCode,
  ResourceNotFoundException,
  DuplicateResourceException,
  UnauthorizedException,
  TokenExpiredException,
  AccountDisabledException,
  VerificationCodeException,
  MembershipRequiredException,
  MembershipExpiredException,
  OrderAlreadyPaidException,
  InsufficientBalanceException,
  RateLimitExceededException,
  DatabaseException,
  ExternalServiceException,
  ServiceUnavailableException,
} from "./business.exception";

describe("BusinessException", () => {
  describe("基础业务异常", () => {
    it("应创建具有正确属性的业务异常", () => {
      const exception = new BusinessException(
        "测试错误",
        ErrorCode.UNKNOWN_ERROR,
      );

      expect(exception).toBeInstanceOf(BusinessException);
      expect(exception.errorCode).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("测试错误");
      expect(response.errorCode).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(response.timestamp).toBeDefined();
    });

    it("应支持自定义 HTTP 状态码", () => {
      const exception = new BusinessException(
        "测试错误",
        ErrorCode.UNKNOWN_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("ResourceNotFoundException", () => {
    it("应创建不带标识符的资源未找到异常", () => {
      const exception = new ResourceNotFoundException("用户");

      expect(exception.errorCode).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("用户 不存在");
    });

    it("应创建带标识符的资源未找到异常", () => {
      const exception = new ResourceNotFoundException("用户", 123);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("用户 (ID: 123) 不存在");
    });

    it("应支持字符串标识符", () => {
      const exception = new ResourceNotFoundException("订单", "ORD-001");

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("订单 (ID: ORD-001) 不存在");
    });
  });

  describe("DuplicateResourceException", () => {
    it("应创建不带字段的重复资源异常", () => {
      const exception = new DuplicateResourceException("用户");

      expect(exception.errorCode).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("用户 已存在");
    });

    it("应创建带字段的重复资源异常", () => {
      const exception = new DuplicateResourceException("用户", "手机号");

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("用户 的 手机号 已存在");
    });
  });

  describe("认证相关异常", () => {
    it("UnauthorizedException 应使用默认消息", () => {
      const exception = new UnauthorizedException();

      expect(exception.errorCode).toBe(ErrorCode.UNAUTHORIZED);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("请先登录");
    });

    it("UnauthorizedException 应支持自定义消息", () => {
      const exception = new UnauthorizedException("Token 无效");

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("Token 无效");
    });

    it("TokenExpiredException 应返回正确信息", () => {
      const exception = new TokenExpiredException();

      expect(exception.errorCode).toBe(ErrorCode.TOKEN_EXPIRED);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("登录已过期，请重新登录");
    });

    it("AccountDisabledException 应返回正确信息", () => {
      const exception = new AccountDisabledException();

      expect(exception.errorCode).toBe(ErrorCode.ACCOUNT_DISABLED);
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("账号已被禁用，请联系客服");
    });

    it("VerificationCodeException 应返回正确信息", () => {
      const exception = new VerificationCodeException();

      expect(exception.errorCode).toBe(ErrorCode.VERIFICATION_CODE_INVALID);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("验证码错误");
    });
  });

  describe("会员相关异常", () => {
    it("MembershipRequiredException 应使用默认消息", () => {
      const exception = new MembershipRequiredException();

      expect(exception.errorCode).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("请先购买会员");
    });

    it("MembershipRequiredException 应支持等级名称", () => {
      const exception = new MembershipRequiredException("高级会员");

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("请先购买「高级会员」会员");
    });

    it("MembershipExpiredException 应返回正确信息", () => {
      const exception = new MembershipExpiredException();

      expect(exception.errorCode).toBe(ErrorCode.MEMBERSHIP_EXPIRED);
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("会员已过期，请续费");
    });
  });

  describe("订单相关异常", () => {
    it("OrderAlreadyPaidException 应返回正确信息", () => {
      const exception = new OrderAlreadyPaidException();

      expect(exception.errorCode).toBe(ErrorCode.ORDER_ALREADY_PAID);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("订单已支付");
    });

    it("InsufficientBalanceException 应返回正确信息", () => {
      const exception = new InsufficientBalanceException();

      expect(exception.errorCode).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("余额不足");
    });
  });

  describe("系统相关异常", () => {
    it("RateLimitExceededException 应使用默认消息", () => {
      const exception = new RateLimitExceededException();

      expect(exception.errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("请求过于频繁，请稍后重试");
    });

    it("RateLimitExceededException 应支持重试时间", () => {
      const exception = new RateLimitExceededException(30);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("请求过于频繁，请 30 秒后重试");
    });

    it("DatabaseException 应返回正确信息", () => {
      const exception = new DatabaseException();

      expect(exception.errorCode).toBe(ErrorCode.DATABASE_ERROR);
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("数据库操作失败");
    });

    it("ExternalServiceException 应包含服务名称", () => {
      const exception = new ExternalServiceException("微信支付");

      expect(exception.errorCode).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("外部服务 微信支付 暂不可用，请稍后重试");
    });

    it("ServiceUnavailableException 应返回正确信息", () => {
      const exception = new ServiceUnavailableException();

      expect(exception.errorCode).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      const response = exception.getResponse() as Record<string, any>;
      expect(response.message).toBe("服务暂时不可用，请稍后重试");
    });
  });

  describe("ErrorCode 枚举", () => {
    it("应包含所有预定义的错误码", () => {
      expect(ErrorCode.UNKNOWN_ERROR).toBe("ERR_1000");
      expect(ErrorCode.VALIDATION_FAILED).toBe("ERR_1001");
      expect(ErrorCode.RESOURCE_NOT_FOUND).toBe("ERR_1002");
      expect(ErrorCode.DUPLICATE_RESOURCE).toBe("ERR_1003");
      expect(ErrorCode.UNAUTHORIZED).toBe("ERR_1100");
      expect(ErrorCode.USER_NOT_FOUND).toBe("ERR_1200");
      expect(ErrorCode.ORDER_NOT_FOUND).toBe("ERR_1300");
      expect(ErrorCode.MEMBERSHIP_REQUIRED).toBe("ERR_1400");
      expect(ErrorCode.DATABASE_ERROR).toBe("ERR_1900");
    });
  });
});
