/**
 * @file 应用程序入口文件
 * @description NestJS 应用的启动入口，配置全局中间件、Swagger 文档等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, VersioningType } from "@nestjs/common";
import { SwaggerModule } from "@nestjs/swagger";
import { createSwaggerConfig } from "./common/documentation/swagger.config";
import { ConfigService } from "@nestjs/config";
import helmet, { HelmetOptions } from "helmet";
import { Request, Response, NextFunction } from "express";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor";
import { RequestTrackingMiddleware } from "./common/middleware/request-tracking.middleware";
import { ActivityTrackingMiddleware } from "./common/middleware/activity-tracking.middleware";
import { CompressionMiddleware } from "./common/middleware/compression.middleware";
import { validateAllConfigs, ConfigValidationError } from "./config/config.validator";
import { bootstrapVault } from "./common/vault/vault.bootstrap";
import { SanitizationMiddleware } from "./common/middleware/sanitization.middleware";

/**
 * 应用程序启动函数
 * @description 初始化 NestJS 应用，配置全局管道、Swagger 文档和 CORS
 */
async function bootstrap(): Promise<void> {
  // Initialize logger for bootstrap process
  const logger = new Logger("Bootstrap");

  // Load critical secrets from vault before configuration validation
  // This ensures vault-supplied secrets are available for config validation
  try {
    await bootstrapVault();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Vault bootstrap failed: ${errorMessage}`);
    // If vault fails critically and required secrets are missing, exit
    if (errorMessage.includes('Required secrets not found')) {
      process.exit(1);
    }
    // Otherwise continue with environment variables
    logger.warn('Continuing with environment variables for configuration');
  }

  // Validate configuration before creating NestJS app
  // This ensures all required environment variables are present and valid
  // before any module initialization occurs
  try {
    validateAllConfigs();
    logger.log("Configuration validation passed");
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      logger.error("Configuration validation failed:");
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  // 获取配置服务
  const configService = app.get(ConfigService);

  // 启用 API 版本控制
  // 使用 URI 版本策略: /api/v1/..., /api/v2/...
  // 默认版本为 v1，当未指定版本时自动路由到 v1
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // 设置全局 API 前缀
  app.setGlobalPrefix("api");

  // 配置 cookie-parser 中间件
  // 用于解析 HTTP Cookie 头，填充 req.cookies
  // secret 参数用于签名 cookie（可选），如果需要签名则使用 COOKIE_SECRET 环境变量
  const cookieSecret = configService.get<string>("COOKIE_SECRET");
  if (cookieSecret) {
    app.use(cookieParser(cookieSecret));
    logger.log("Cookie parser enabled with secret signing");
  } else {
    app.use(cookieParser());
    logger.log("Cookie parser enabled without secret signing");
  }

  // 配置安全头中间件（Helmet）
  // 从配置服务获取安全设置，实现可配置的 HTTP 安全头
  const securityConfig = configService.get("security");
  if (!securityConfig) {
    logger.error(
      "Security configuration not found. Please ensure securityConfig is properly registered in AppModule.",
    );
    throw new Error("Security configuration is missing");
  }

  // 仅在启用时应用 Helmet 安全头
  if (securityConfig.enabled) {
    // 构建 CSP 指令对象
    const cspDirectives: any = {};
    if (securityConfig.contentSecurityPolicy.enabled) {
      const directives = securityConfig.contentSecurityPolicy.directives;
      cspDirectives.defaultSrc = directives.defaultSrc;
      cspDirectives.scriptSrc = directives.scriptSrc;
      cspDirectives.styleSrc = directives.styleSrc;
      cspDirectives.imgSrc = directives.imgSrc;
      cspDirectives.connectSrc = directives.connectSrc;
      cspDirectives.fontSrc = directives.fontSrc;
      cspDirectives.objectSrc = directives.objectSrc;
      cspDirectives.mediaSrc = directives.mediaSrc;
      cspDirectives.frameSrc = directives.frameSrc;
      cspDirectives.workerSrc = directives.workerSrc;
      cspDirectives.baseUri = directives.baseUri;
      cspDirectives.formAction = directives.formAction;
      cspDirectives.frameAncestors = directives.frameAncestors;

      // 升级不安全请求（HTTP -> HTTPS）
      if (directives.upgradeInsecureRequests) {
        cspDirectives.upgradeInsecureRequests = [];
      }
    }

    // 构建 Helmet 配置选项
    const helmetOptions: HelmetOptions = {
      // CSP 配置
      contentSecurityPolicy: securityConfig.contentSecurityPolicy.enabled
        ? {
            directives: cspDirectives,
          }
        : false,

      // HSTS 配置
      hsts: securityConfig.hsts.enabled
        ? {
            maxAge: securityConfig.hsts.maxAge,
            includeSubDomains: securityConfig.hsts.includeSubDomains,
            preload: securityConfig.hsts.preload,
          }
        : false,

      // X-Frame-Options（通过 frameguard 控制）
      // Note: ALLOW-FROM is deprecated in modern browsers, use CSP frame-ancestors instead
      frameguard: {
        action: securityConfig.xFrameOptions === "SAMEORIGIN"
          ? "sameorigin"
          : "deny",
      },

      // 禁用跨域嵌入策略以兼容某些第三方资源
      crossOriginEmbedderPolicy: securityConfig.crossOriginEmbedderPolicy
        ? { policy: "require-corp" }
        : false,

      // 跨域资源策略
      crossOriginResourcePolicy: securityConfig.crossOriginResourcePolicy
        ? { policy: "cross-origin" }
        : false,

      // Referrer-Policy
      referrerPolicy: { policy: securityConfig.referrerPolicy },

      // 其他安全头
      noSniff: true, // X-Content-Type-Options: nosniff
      xssFilter: true, // X-XSS-Protection (已过时但保留)
    };

    app.use(helmet(helmetOptions));

    // Permissions-Policy (原 Feature-Policy)
    // Helmet 8.x 不再内置 Permissions-Policy，需要手动设置
    const permissionsPolicyValue = Object.entries(securityConfig.permissionsPolicy)
      .map(([feature, origins]) => `${feature}=(${Array.isArray(origins) ? origins.join(" ") : origins})`)
      .join(", ");
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Permissions-Policy", permissionsPolicyValue);
      next();
    });
    logger.log("Helmet security headers enabled with custom configuration");

    // 记录 HSTS 状态
    if (securityConfig.hsts.enabled) {
      logger.log(
        `HSTS enabled: maxAge=${securityConfig.hsts.maxAge}s, ` +
          `includeSubDomains=${securityConfig.hsts.includeSubDomains}, ` +
          `preload=${securityConfig.hsts.preload}`,
      );
    } else {
      logger.warn("HSTS is disabled. In production, HSTS should be enabled.");
    }

    // 记录 CSP 状态
    if (securityConfig.contentSecurityPolicy.enabled) {
      logger.log("Content Security Policy enabled");
    } else {
      logger.warn("Content Security Policy is disabled. Consider enabling for better security.");
    }
  } else {
    logger.warn("Security headers middleware is disabled. Enable by setting SECURITY_ENABLED=true");
  }

  // 配置压缩中间件
  // 使用 ConfigService 获取压缩配置
  const compressionMiddleware = new CompressionMiddleware(configService);
  app.use(compressionMiddleware.use.bind(compressionMiddleware));

  // 配置请求追踪中间件
  // 必须在其他中间件之前注册，以便所有后续中间件的日志都能包含 requestId/correlationId
  app.use(
    new RequestTrackingMiddleware().use.bind(new RequestTrackingMiddleware()),
  );

  // 配置输入清洗中间件
  // 使用 ConfigService 获取清洗配置
  // 在请求处理前清洗所有输入数据，防止 XSS 和注入攻击
  // 必须在请求追踪之后注册，以便清洗日志包含请求追踪 ID
  const sanitizationMiddleware = new SanitizationMiddleware(configService);
  app.use(sanitizationMiddleware.use.bind(sanitizationMiddleware));

  // 配置活动追踪中间件
  app.use(
    new ActivityTrackingMiddleware().use.bind(new ActivityTrackingMiddleware()),
  );

  // 配置全局验证管道
  // - whitelist: 自动过滤掉 DTO 中未定义的属性
  // - forbidNonWhitelisted: 当请求包含未定义属性时抛出错误
  // - transform: 自动将请求参数转换为 DTO 类型
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 配置全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 配置全局拦截器
  // 注意：拦截器执行顺序为先进后出（LIFO）
  // - TimeoutInterceptor: 设置请求超时（30秒）
  // - LoggingInterceptor: 记录请求日志
  // - TransformInterceptor: 转换响应格式
  // - ApmInterceptor: 在 AppModule 中通过 APP_INTERCEPTOR 全局注册
  app.useGlobalInterceptors(
    new TimeoutInterceptor(), // 超时拦截器（最先执行）
    new LoggingInterceptor(), // 日志拦截器
    new TransformInterceptor(), // 响应转换拦截器（最后执行）
  );

  // 启用 CORS（跨域资源共享）
  // 从配置服务获取 CORS 设置，支持多域名白名单
  const corsOptions = configService.get("cors");
  if (!corsOptions) {
    logger.error(
      "CORS configuration not found. Please ensure corsConfig is properly registered in AppModule.",
    );
    throw new Error("CORS configuration is missing");
  }

  // 生产环境安全检查
  const isProduction = process.env.NODE_ENV === "production";
  const originValue = corsOptions.origin;

  if (isProduction && (originValue === "*" || originValue === true)) {
    logger.error(
      "SECURITY: CORS origin is set to wildcard (*) in production environment. " +
        'This is a security vulnerability. Please set CORS_ORIGIN to specific domain(s).',
    );
    throw new Error(
      'Cannot start with wildcard CORS origin in production. Set CORS_ORIGIN to specific domain(s).',
    );
  }

  app.enableCors(corsOptions);
  logger.log(
    `CORS enabled with origin: ${JSON.stringify(originValue)} (credentials: ${corsOptions.credentials})`,
  );

  // 配置 Swagger API 文档
  // 使用集中的 Swagger 配置，包含详细的认证、版本控制和响应格式文档
  const config = createSwaggerConfig();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  // 获取端口号，默认 3000
  const port = process.env.PORT || 3000;

  // 启动应用
  await app.listen(port);

  logger.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   医学宝典 API 服务已启动                              ║
║                                                       ║
║   运行环境: ${process.env.NODE_ENV || "development"}                              ║
║   服务地址: http://localhost:${port}                       ║
║   API 文档: http://localhost:${port}/api-docs              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();
