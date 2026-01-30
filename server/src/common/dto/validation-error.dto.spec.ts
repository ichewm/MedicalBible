/**
 * @file 验证错误 DTO 测试
 * @description 测试 ValidationErrorDto 类
 */

import { ValidationErrorDto } from "./validation-error.dto";

describe("ValidationErrorDto", () => {
  it("should create a validation error with all properties", () => {
    const validationError: ValidationErrorDto = {
      field: "email",
      message: "邮箱格式不正确",
      constraint: "isEmail",
    };

    expect(validationError.field).toBe("email");
    expect(validationError.message).toBe("邮箱格式不正确");
    expect(validationError.constraint).toBe("isEmail");
  });

  it("should create a validation error without constraint", () => {
    const validationError: ValidationErrorDto = {
      field: "password",
      message: "密码长度不能少于8位",
    };

    expect(validationError.field).toBe("password");
    expect(validationError.message).toBe("密码长度不能少于8位");
    expect(validationError.constraint).toBeUndefined();
  });

  it("should handle nested field names", () => {
    const validationError: ValidationErrorDto = {
      field: "address.street",
      message: "街道地址不能为空",
      constraint: "isNotEmpty",
    };

    expect(validationError.field).toBe("address.street");
    expect(validationError.message).toBe("街道地址不能为空");
    expect(validationError.constraint).toBe("isNotEmpty");
  });

  it("should handle array field names", () => {
    const validationError: ValidationErrorDto = {
      field: "tags[0]",
      message: "标签格式不正确",
      constraint: "isString",
    };

    expect(validationError.field).toBe("tags[0]");
    expect(validationError.message).toBe("标签格式不正确");
    expect(validationError.constraint).toBe("isString");
  });

  it("should handle Chinese constraint names", () => {
    const error: ValidationErrorDto = {
      field: "phone",
      message: "手机号码格式不正确",
      constraint: "isPhoneNumber",
    };

    expect(error.field).toBe("phone");
    expect(error.message).toBe("手机号码格式不正确");
    expect(error.constraint).toBe("isPhoneNumber");
  });

  it("should handle empty field name (unknown)", () => {
    const error: ValidationErrorDto = {
      field: "unknown",
      message: "验证失败",
    };

    expect(error.field).toBe("unknown");
    expect(error.message).toBe("验证失败");
  });

  it("should allow multiple validation errors", () => {
    const errors: ValidationErrorDto[] = [
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
      {
        field: "age",
        message: "年龄必须大于等于18岁",
        constraint: "min",
      },
    ];

    expect(errors).toHaveLength(3);
    expect(errors[0].field).toBe("email");
    expect(errors[1].field).toBe("password");
    expect(errors[2].field).toBe("age");
  });

  it("should handle constraint with camelCase", () => {
    const error: ValidationErrorDto = {
      field: "username",
      message: "用户名只能包含字母和数字",
      constraint: "matches",
    };

    expect(error.constraint).toBe("matches");
  });

  it("should allow undefined constraint type", () => {
    const error: ValidationErrorDto = {
      field: "customField",
      message: "自定义验证错误",
    };

    expect(error.constraint).toBeUndefined();
  });

  it("should handle very long field names", () => {
    const longFieldName = "user.profile.address.street.line1";
    const error: ValidationErrorDto = {
      field: longFieldName,
      message: "街道地址不能为空",
    };

    expect(error.field).toBe(longFieldName);
    expect(error.field.length).toBeGreaterThan(20);
  });

  it("should maintain property mutability", () => {
    const error: ValidationErrorDto = {
      field: "email",
      message: "Initial message",
    };

    // DTOs should be mutable for object mapping
    error.message = "Updated message";
    error.constraint = "isEmail";

    expect(error.message).toBe("Updated message");
    expect(error.constraint).toBe("isEmail");
  });

  it("should handle special characters in field names", () => {
    const error: ValidationErrorDto = {
      field: "user-name",
      message: "字段验证失败",
    };

    expect(error.field).toBe("user-name");
  });

  it("should handle numeric field names (edge case)", () => {
    const error: ValidationErrorDto = {
      field: "0",
      message: "数组第一项验证失败",
    };

    expect(error.field).toBe("0");
  });

  it("should allow creation with object spread", () => {
    const baseError = {
      field: "email",
      message: "邮箱格式不正确",
      constraint: "isEmail" as const,
    };

    const error: ValidationErrorDto = { ...baseError };

    expect(error.field).toBe("email");
    expect(error.message).toBe("邮箱格式不正确");
    expect(error.constraint).toBe("isEmail");
  });

  it("should handle empty string values", () => {
    const error: ValidationErrorDto = {
      field: "",
      message: "",
    };

    expect(error.field).toBe("");
    expect(error.message).toBe("");
  });

  it("should handle Unicode characters in field names", () => {
    const error: ValidationErrorDto = {
      field: "用户名",
      message: "用户名不能为空",
    };

    expect(error.field).toBe("用户名");
    expect(error.message).toBe("用户名不能为空");
  });
});
