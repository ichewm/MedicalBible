/**
 * @file 自定义清洗验证器
 * @description 自定义 class-validator 验证器，用于检测 HTML 和脚本内容
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * 检测脚本标签的验证约束
 */
@ValidatorConstraint({ name: "NoScriptTags", async: false })
export class NoScriptTagsConstraint implements ValidatorConstraintInterface {
  /**
   * 验证值是否包含脚本标签
   * @param value 要验证的值
   * @returns 如果不包含脚本标签返回 true
   */
  validate(value: any): boolean {
    if (typeof value !== "string") {
      return true;
    }

    // 检测常见的脚本注入模式
    const scriptPatterns = [
      /<script\b[^>]*>[\s\S]*?<\/script>/gi, // 完整的 script 标签
      /<script\b[^>]*>/gi, // 不完整的 script 标签
      /javascript:/gi, // javascript: 协议
      /on\w+\s*=/gi, // 事件处理器（如 onclick=）
      /<iframe[^>]*>/gi, // iframe 标签
      /<object[^>]*>/gi, // object 标签
      /<embed[^>]*>/gi, // embed 标签
      /<link[^>]*>/gi, // link 标签（可能引入外部脚本）
      /@import/gi, // CSS 导入
      /expression\s*\(/gi, // CSS expression
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains potentially malicious script content or HTML tags`;
  }
}

/**
 * 不包含脚本标签的装饰器
 * @param validationOptions 验证选项
 */
export function NoScriptTags(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoScriptTagsConstraint,
    });
  };
}

/**
 * 检测 HTML 标签的验证约束
 */
@ValidatorConstraint({ name: "NoHtmlTags", async: false })
export class NoHtmlTagsConstraint implements ValidatorConstraintInterface {
  /**
   * 验证值是否包含 HTML 标签
   * @param value 要验证的值
   * @returns 如果不包含 HTML 标签返回 true
   */
  validate(value: any): boolean {
    if (typeof value !== "string") {
      return true;
    }

    // 检测 HTML 标签
    const htmlPattern = /<[^>]+>/gi;
    return !htmlPattern.test(value);
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must not contain HTML tags`;
  }
}

/**
 * 不包含 HTML 标签的装饰器
 * @param validationOptions 验证选项
 */
export function NoHtmlTags(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoHtmlTagsConstraint,
    });
  };
}

/**
 * 检测 URL 注入的验证约束
 */
@ValidatorConstraint({ name: "SafeUrl", async: false })
export class SafeUrlConstraint implements ValidatorConstraintInterface {
  /**
   * 验证 URL 是否安全
   * @param value 要验证的值
   * @returns 如果 URL 安全返回 true
   */
  validate(value: any): boolean {
    if (typeof value !== "string") {
      return true;
    }

    // 检测危险的 URL 协议
    const dangerousProtocols = [
      /^javascript:/i,
      /^data:text\/html/i,
      /^data:application\/xhtml/i,
      /^vbscript:/i,
      /^file:/i,
    ];

    for (const protocol of dangerousProtocols) {
      if (protocol.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains an unsafe URL protocol`;
  }
}

/**
 * 安全 URL 的装饰器
 * @param validationOptions 验证选项
 */
export function SafeUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SafeUrlConstraint,
    });
  };
}

/**
 * 检测 SQL 注入模式的验证约束
 */
@ValidatorConstraint({ name: "NoSqlInjection", async: false })
export class NoSqlInjectionConstraint implements ValidatorConstraintInterface {
  /**
   * 验证值是否包含 SQL 注入模式
   * @param value 要验证的值
   * @returns 如果不包含 SQL 注入模式返回 true
   */
  validate(value: any): boolean {
    if (typeof value !== "string") {
      return true;
    }

    // 检测常见的 SQL 注入模式
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/gi,
      /(\b(UNION|EXEC|EXECUTE|SCRIPT)\b)/gi,
      /(;(\s+)?(DROP|DELETE|UPDATE|INSERT))/gi,
      /('.*?(OR|AND)\s+.*?=)/gi,
      /(--|\/\*|\*\/)/gi,
      /(\b(XP_|SP_)\w+)/gi, // SQL Server 扩展存储过程
      /(\b(CONCAT|CHAR|ASCII|SUBSTRING)\b)/gi,
    ];

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains potentially malicious SQL injection patterns`;
  }
}

/**
 * 不包含 SQL 注入模式的装饰器
 * @param validationOptions 验证选项
 */
export function NoSqlInjection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoSqlInjectionConstraint,
    });
  };
}

/**
 * 检测命令注入模式的验证约束
 */
@ValidatorConstraint({ name: "NoCommandInjection", async: false })
export class NoCommandInjectionConstraint implements ValidatorConstraintInterface {
  /**
   * 验证值是否包含命令注入模式
   * @param value 要验证的值
   * @returns 如果不包含命令注入模式返回 true
   */
  validate(value: any): boolean {
    if (typeof value !== "string") {
      return true;
    }

    // 检测常见的命令注入模式
    const commandInjectionPatterns = [
      /[;&|`$()]/, // 命令分隔符和特殊字符
      /\$\([^)]*\)/, // 命令替换
      /`[^`]*`/, // 反引号命令替换
      /\|\|?/, // 管道
      /&&/, // 命令连接
      />/, // 输出重定向
      /</, // 输入重定向
    ];

    for (const pattern of commandInjectionPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains potentially malicious command injection patterns`;
  }
}

/**
 * 不包含命令注入模式的装饰器
 * @param validationOptions 验证选项
 */
export function NoCommandInjection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoCommandInjectionConstraint,
    });
  };
}
