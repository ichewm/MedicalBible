/**
 * @file APM 服务
 * @description 应用性能监控服务，提供分布式追踪和指标收集功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  trace,
  metrics,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from "@opentelemetry/api";
import {
  NodeSDK,
} from "@opentelemetry/sdk-node";
import {
  Resource,
  ResourceAttributes,
} from "@opentelemetry/resources";
import {
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import {
  Sampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from "@opentelemetry/sdk-metrics";
import {
  OTLPTraceExporter,
} from "@opentelemetry/exporter-trace-otlp-grpc";
import {
  OTLPMetricExporter,
} from "@opentelemetry/exporter-metrics-otlp-grpc";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { apmConfig, ApmServiceType, createResourceAttributes } from "../../config/apm.config";

/**
 * 性能指标数据接口
 */
export interface PerformanceMetric {
  /** 指标名称 */
  name: string;
  /** 指标值 */
  value: number;
  /** 标签 */
  labels?: Record<string, string>;
  /** 时间戳 */
  timestamp?: number;
}

/**
 * 告警事件接口
 */
export interface AlertEvent {
  /** 告警名称 */
  name: string;
  /** 严重级别 */
  severity: "critical" | "warning" | "info";
  /** 消息 */
  message: string;
  /** 相关指标 */
  metric?: string;
  /** 当前值 */
  value?: number;
  /** 阈值 */
  threshold?: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * APM 运行时状态接口
 */
export interface ApmStatus {
  /** APM 是否启用 */
  enabled: boolean;
  /** 追踪是否启用 */
  tracingEnabled: boolean;
  /** 指标是否启用 */
  metricsEnabled: boolean;
  /** 服务名称 */
  serviceName: string;
  /** 服务类型 */
  serviceType: ApmServiceType;
  /** 采样率 */
  sampleRate: number;
}

/**
 * APM 服务类
 * @description 提供 OpenTelemetry 初始化、追踪和指标收集功能
 */
@Injectable()
export class ApmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApmService.name);
  private sdk: NodeSDK | null = null;
  private config: ReturnType<typeof apmConfig>;
  private metricReader: any | null = null;
  private alertState = new Map<string, number>(); // 记录上次告警时间

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get("apm") || apmConfig();
  }

  /**
   * 模块初始化：启动 OpenTelemetry SDK
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log("APM is disabled by configuration");
      return;
    }

    try {
      await this.initializeOpenTelemetry();
      this.logger.log(
        `APM initialized successfully (Service: ${this.config.serviceName}, Type: ${this.config.serviceType})`,
      );
    } catch (error) {
      this.logger.error("Failed to initialize APM", error);
      // 不阻止应用启动，APM 失败不应影响主业务
    }
  }

  /**
   * 模块销毁：关闭 OpenTelemetry SDK
   */
  async onModuleDestroy(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log("APM shut down successfully");
      } catch (error) {
        this.logger.error("Error during APM shutdown", error);
      }
    }
  }

  /**
   * 初始化 OpenTelemetry
   * @description 配置并启动 OpenTelemetry SDK
   */
  private async initializeOpenTelemetry(): Promise<void> {
    // 配置诊断日志（开发环境启用详细日志）
    if (this.config.environment === "development") {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    // 创建资源
    const resource = this.createResource();

    // 配置导出器
    const spanExporters = this.createSpanExporters();
    const metricReaders = this.createMetricReaders();

    // 配置自动检测
    const autoInstrumentations = getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": {
        enabled: this.config.tracingEnabled,
      },
      "@opentelemetry/instrumentation-ioredis": {
        enabled: this.config.tracingEnabled,
      },
    });

    // SDK 配置
    const sdkConfig = {
      resource,
      traceExporter: spanExporters.length > 0 ? spanExporters[0] : undefined,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      instrumentations: [autoInstrumentations],
      sampler: this.createSampler(),
      spanProcessor: this.createSpanProcessor(),
    };

    // 创建并启动 SDK
    this.sdk = new NodeSDK(sdkConfig);
    await this.sdk.start();

    this.logger.log(
      `OpenTelemetry SDK started - Tracing: ${this.config.tracingEnabled}, Metrics: ${this.config.metricsEnabled}`,
    );
  }

  /**
   * 创建资源标识
   */
  private createResource(): Resource {
    const attributes = createResourceAttributes();
    return new Resource(attributes);
  }

  /**
   * 创建 Span 导出器
   */
  private createSpanExporters(): any[] {
    const exporters: any[] = [];

    if (!this.config.tracingEnabled) {
      return exporters;
    }

    switch (this.config.serviceType) {
      case ApmServiceType.CONSOLE:
        exporters.push(new ConsoleSpanExporter());
        this.logger.log("Using Console Span Exporter");
        break;

      case ApmServiceType.OTLP:
      case ApmServiceType.JAEGER:
      case ApmServiceType.ZIPKIN:
        exporters.push(
          new OTLPTraceExporter({
            url: this.config.otlpEndpoint,
            headers: this.config.otlpHeaders,
          }),
        );
        this.logger.log(`Using OTLP Trace Exporter: ${this.config.otlpEndpoint}`);
        break;

      default:
        exporters.push(new ConsoleSpanExporter());
        this.logger.log("Using default Console Span Exporter");
    }

    return exporters;
  }

  /**
   * 创建 Metric 读取器
   */
  private createMetricReaders(): any[] {
    const readers: any[] = [];

    if (!this.config.metricsEnabled) {
      return readers;
    }

    switch (this.config.serviceType) {
      case ApmServiceType.CONSOLE:
        readers.push(
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: this.config.metricsExportInterval,
          }),
        );
        this.logger.log("Using Console Metric Exporter");
        break;

      case ApmServiceType.OTLP:
      case ApmServiceType.JAEGER:
      case ApmServiceType.ZIPKIN:
        readers.push(
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: this.config.otlpEndpoint,
              headers: this.config.otlpHeaders,
            }),
            exportIntervalMillis: this.config.metricsExportInterval,
          }),
        );
        this.logger.log(`Using OTLP Metric Exporter: ${this.config.otlpEndpoint}`);
        break;

      default:
        readers.push(
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: this.config.metricsExportInterval,
          }),
        );
    }

    return readers;
  }

  /**
   * 创建采样器
   */
  private createSampler(): any {
    // 使用基于概率的采样器
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(this.config.sampleRate),
    });
  }

  /**
   * 创建 Span 处理器
   */
  private createSpanProcessor(): any {
    // 生产环境使用批处理，开发环境使用简单处理器
    const isProduction = this.config.environment === "production";

    if (isProduction) {
      return new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: this.config.otlpEndpoint,
          headers: this.config.otlpHeaders,
        }),
      );
    } else {
      return new SimpleSpanProcessor(new ConsoleSpanExporter());
    }
  }

  /**
   * 记录自定义指标
   * @param metric 指标数据
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.config.metricsEnabled) {
      return;
    }

    try {
      const meter = metrics.getMeter("medical-bible-apm");
      const labels = metric.labels || {};

      // 创建计数器或测量值
      const counter = meter.createCounter(metric.name, {
        description: `Custom metric: ${metric.name}`,
      });

      counter.add(metric.value, labels);
      this.logger.debug(`Recorded metric: ${metric.name} = ${metric.value}`);
    } catch (error) {
      this.logger.error(`Failed to record metric: ${metric.name}`, error);
    }
  }

  /**
   * 记录 HTTP 请求指标
   * @param method HTTP 方法
   * @param route 路由
   * @param statusCode 状态码
   * @param duration 耗时（毫秒）
   * @param userId 用户 ID（可选）
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    userId?: number,
  ): void {
    const labels: Record<string, string> = {
      method,
      route,
      status_code: String(statusCode),
      status: statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "success",
    };

    if (userId) {
      labels.user_id = String(userId);
    }

    // 记录请求数量
    this.recordMetric({
      name: "http_requests_total",
      value: 1,
      labels,
    });

    // 记录请求耗时
    this.recordMetric({
      name: "http_request_duration_milliseconds",
      value: duration,
      labels,
    });

    // 检查慢请求
    if (duration >= this.config.httpRequestThreshold) {
      this.recordMetric({
        name: "http_slow_requests_total",
        value: 1,
        labels: {
          ...labels,
          threshold: String(this.config.httpRequestThreshold),
        },
      });
    }

    // 检查告警规则
    this.checkAlerts("http", labels, duration);
  }

  /**
   * 记录数据库查询指标
   * @param operation 操作类型
   * @param table 表名
   * @param duration 耗时（毫秒）
   */
  recordDbQuery(operation: string, table: string, duration: number): void {
    const labels: Record<string, string> = {
      operation,
      table,
    };

    // 记录查询数量
    this.recordMetric({
      name: "db_queries_total",
      value: 1,
      labels,
    });

    // 记录查询耗时
    this.recordMetric({
      name: "db_query_duration_milliseconds",
      value: duration,
      labels,
    });

    // 检查慢查询
    if (duration >= this.config.dbQueryThreshold) {
      this.recordMetric({
        name: "db_slow_queries_total",
        value: 1,
        labels: {
          ...labels,
          threshold: String(this.config.dbQueryThreshold),
        },
      });
    }

    // 检查告警
    this.checkAlerts("db", labels, duration);
  }

  /**
   * 记录 Redis 命令指标
   * @param command Redis 命令
   * @param duration 耗时（毫秒）
   */
  recordRedisCommand(command: string, duration: number): void {
    const labels: Record<string, string> = {
      command,
    };

    this.recordMetric({
      name: "redis_commands_total",
      value: 1,
      labels,
    });

    this.recordMetric({
      name: "redis_command_duration_milliseconds",
      value: duration,
      labels,
    });

    if (duration >= this.config.redisCommandThreshold) {
      this.recordMetric({
        name: "redis_slow_commands_total",
        value: 1,
        labels: {
          ...labels,
          threshold: String(this.config.redisCommandThreshold),
        },
      });
    }
  }

  /**
   * 检查告警规则
   * @param type 指标类型
   * @param labels 标签
   * @param value 当前值
   */
  private checkAlerts(
    type: string,
    labels: Record<string, string>,
    value: number,
  ): void {
    if (!this.config.alerts.enabled) {
      return;
    }

    const now = Date.now();
    const throttleMs = this.config.alerts.throttleInterval * 1000;

    for (const rule of this.config.alerts.rules) {
      const alertKey = `${rule.name}_${JSON.stringify(labels)}`;
      const lastAlertTime = this.alertState.get(alertKey) || 0;

      // 检查是否在限流时间内
      if (now - lastAlertTime < throttleMs) {
        continue;
      }

      // 检查告警条件
      let shouldAlert = false;
      switch (rule.operator) {
        case "gt":
          shouldAlert = value > rule.threshold;
          break;
        case "lt":
          shouldAlert = value < rule.threshold;
          break;
        case "eq":
          shouldAlert = value === rule.threshold;
          break;
        case "gte":
          shouldAlert = value >= rule.threshold;
          break;
        case "lte":
          shouldAlert = value <= rule.threshold;
          break;
      }

      if (shouldAlert) {
        this.triggerAlert({
          name: rule.name,
          severity: rule.severity as "critical" | "warning" | "info",
          message: `Alert: ${rule.name} - ${type} metric ${rule.operator} ${rule.threshold}, current: ${value}`,
          metric: `${type}_${labels.operation || labels.method || "unknown"}`,
          value,
          threshold: rule.threshold,
          timestamp: now,
        });

        // 更新告警时间
        this.alertState.set(alertKey, now);
      }
    }
  }

  /**
   * 触发告警
   * @param alert 告警事件
   */
  private triggerAlert(alert: AlertEvent): void {
    this.logger.warn(`[ALERT] ${alert.message}`);

    // 如果配置了 Webhook，发送告警通知
    if (this.config.alerts.webhookUrl) {
      this.sendWebhookAlert(alert).catch((error) => {
        this.logger.error("Failed to send alert webhook", error);
      });
    }
  }

  /**
   * 发送 Webhook 告警
   * @param alert 告警事件
   */
  private async sendWebhookAlert(alert: AlertEvent): Promise<void> {
    try {
      const response = await fetch(this.config.alerts.webhookUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alert,
          service: this.config.serviceName,
          environment: this.config.environment,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      this.logger.error("Failed to send alert webhook", error);
      throw error;
    }
  }

  /**
   * 获取当前 Span
   */
  getCurrentSpan(): any {
    return trace.getSpan(context.active());
  }

  /**
   * 创建自定义 Span
   * @param name Span 名称
   * @param fn 要执行的函数
   */
  async runInSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const tracer = trace.getTracer("medical-bible-apm");
    return await tracer.startActiveSpan(name, async (span) => {
      const result = await fn();
      return result;
      // Note: span.end() is called automatically by startActiveSpan when the callback completes
    });
  }

  /**
   * 获取 APM 状态
   */
  getStatus(): ApmStatus {
    return {
      enabled: this.config.enabled,
      tracingEnabled: this.config.tracingEnabled,
      metricsEnabled: this.config.metricsEnabled,
      serviceName: this.config.serviceName,
      serviceType: this.config.serviceType,
      sampleRate: this.config.sampleRate,
    };
  }
}

// 导入上下文和状态码
import { context, SpanStatusCode } from "@opentelemetry/api";
