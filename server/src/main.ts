/**
 * @file 应用程序入口文件
 * @description NestJS 应用的启动入口，配置全局中间件、Swagger 文档等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor";
import { RequestTrackingMiddleware } from "./common/middleware/request-tracking.middleware";

/**
 * 应用程序启动函数
 * @description 初始化 NestJS 应用，配置全局管道、Swagger 文档和 CORS
 */
async function bootstrap(): Promise<void> {
  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  // 获取配置服务
  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  // 启用 API 版本控制
  // 使用 URI 版本策略: /api/v1/..., /api/v2/...
  // 默认版本为 v1，当未指定版本时自动路由到 v1
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // 设置全局 API 前缀
  app.setGlobalPrefix("api");

  // 启用安全头中间件（Helmet）
  // 设置各种 HTTP 头以提高安全性，防止常见 Web 漏洞
  // 注意：需要配置 contentSecurityPolicy 以允许 Swagger 和静态资源
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // 禁用以兼容某些第三方资源
    }),
  );
  logger.log("Helmet security headers enabled");

  // 配置请求追踪中间件
  app.use(
    new RequestTrackingMiddleware().use.bind(new RequestTrackingMiddleware()),
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
  const config = new DocumentBuilder()
    .setTitle("医学宝典 API")
    .setDescription("医学宝典在线考试平台后端接口文档")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "请输入 JWT Token",
      },
      "JWT-auth",
    )
    .addTag("Auth", "认证模块 - 注册、登录、验证码等")
    .addTag("用户", "用户模块 - 个人信息、设备管理等")
    .addTag("SKU", "SKU模块 - 大类、等级、科目管理")
    .addTag("题库", "题库模块 - 试卷、题目、刷题等")
    .addTag("讲义", "讲义模块 - PDF阅读、重点标注")
    .addTag("订单", "订单模块 - 支付、订阅")
    .addTag("分销", "分销模块 - 推广、佣金、提现")
    .addTag("管理后台", "管理后台 - 系统配置、数据看板")
    .build();

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
