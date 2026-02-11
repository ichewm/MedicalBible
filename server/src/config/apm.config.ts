/**
 * @file APM 配置
 * @description OpenTelemetry APM 配置，支持分布式追踪和性能指标收集
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * APM 服务类型枚举
 * @description 支持的 APM 后端服务类型
 */
export enum ApmServiceType {
  /** 控制台输出（开发环境） */
  CONSOLE = "console",
  /** Jaeger 分布式追踪 */
  JAEGER = "jaeger",
  /** Zipkin 分布式追踪 */
  ZIPKIN = "zipkin",
  /** OpenTelemetry 协议兼容后端 */
  OTLP = "otlp",
  /** DataDog APM */
  DATADOG = "datadog",
  /** New Relic APM */
  NEW_RELIC = "new_relic",
}

/**
 * 指标导出频率枚举
 */
export enum MetricExportInterval {
  /** 5秒 */
  FIVE_SECONDS = 5000,
  /** 10秒 */
  TEN_SECONDS = 10000,
  /** 30秒 */
  THIRTY_SECONDS = 30000,
  /** 60秒 */
  SIXTY_SECONDS = 60000,
}

/**
 * 告警规则配置接口
 */
export interface AlertRule {
  /** 告警规则名称 */
  name: string;
  /** 指标名称 */
  metric: string;
  /** 阈值 */
  threshold: number;
  /** 比较操作符 */
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  /** 告警级别 */
  severity: "critical" | "warning" | "info";
}

/**
 * APM 配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('apm.xxx') 访问
 */
export const apmConfig = registerAs("apm", () => {
  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    /** 是否启用 APM */
    enabled: process.env.APM_ENABLED !== "false",

    /** 服务名称 */
    serviceName: process.env.APM_SERVICE_NAME || "medical-bible-api",

    /** 服务版本 */
    serviceVersion: process.env.APM_SERVICE_VERSION || "1.0.0",

    /** 部署环境 */
    environment: process.env.APM_ENVIRONMENT || process.env.NODE_ENV || "development",

    /** APM 服务类型 */
    serviceType:
      (process.env.APM_SERVICE_TYPE as ApmServiceType) ||
      (isProduction ? ApmServiceType.OTLP : ApmServiceType.CONSOLE),

    /** OTLP 端点（用于 OTLP、Jaeger、Zipkin） */
    otlpEndpoint: process.env.APM_OTLP_ENDPOINT || "http://localhost:4317",

    /** OTLP 导出器头部信息（用于认证） */
    otlpHeaders: process.env.APM_OTLP_HEADERS
      ? JSON.parse(process.env.APM_OTLP_HEADERS)
      : undefined,

    /** 采样率（0-1），生产环境建议 0.1-0.3，开发环境 1.0 */
    sampleRate: parseFloat(process.env.APM_SAMPLE_RATE || (isDevelopment ? "1.0" : "0.1")),

    /** 是否启用分布式追踪 */
    tracingEnabled: process.env.APM_TRACING_ENABLED !== "false",

    /** 是否启用指标收集 */
    metricsEnabled: process.env.APM_METRICS_ENABLED !== "false",

    /** 指标导出间隔（毫秒） */
    metricsExportInterval: parseInt(
      process.env.APM_METRICS_EXPORT_INTERVAL ||
        String(MetricExportInterval.THIRTY_SECONDS),
      10,
    ),

    /** 是否启用日志关联 */
    logsIntegration: process.env.APM_LOGS_INTEGRATION === "true",

    /** 数据库查询追踪阈值（毫秒），超过此值的慢查询会被标记 */
    dbQueryThreshold: parseInt(process.env.APM_DB_QUERY_THRESHOLD || "1000", 10),

    /** HTTP 请求追踪阈值（毫秒），超过此值的慢请求会被标记 */
    httpRequestThreshold: parseInt(process.env.APM_HTTP_REQUEST_THRESHOLD || "3000", 10),

    /** Redis 命令追踪阈值（毫秒） */
    redisCommandThreshold: parseInt(process.env.APM_REDIS_COMMAND_THRESHOLD || "500", 10),

    /** 是否启用自动检测异常 */
    exceptionAutoDetect: process.env.APM_EXCEPTION_AUTO_DETECT !== "false",

    /** 告警配置 */
    alerts: {
      /** 是否启用告警 */
      enabled: process.env.APM_ALERTS_ENABLED === "true",

      /** 告警规则配置 */
      rules: process.env.APM_ALERT_RULES
        ? (JSON.parse(process.env.APM_ALERT_RULES) as AlertRule[])
        : [
            {
              name: "high_error_rate",
              metric: "http_requests_total{status=~\"5..\"}",
              threshold: 0.05,
              operator: "gt",
              severity: "critical",
            },
            {
              name: "high_latency",
              metric: "http_request_duration_milliseconds",
              threshold: 5000,
              operator: "p95",
              severity: "warning",
            },
            {
              name: "slow_db_query",
              metric: "db_query_duration_milliseconds",
              threshold: 3000,
              operator: "p99",
              severity: "warning",
            },
          ],

      /** 告警通知 Webhook URL */
      webhookUrl: process.env.APM_ALERT_WEBHOOK_URL,

      /** 告警通知间隔（秒），防止告警风暴 */
      throttleInterval: parseInt(process.env.APM_ALERT_THROTTLE_INTERVAL || "300", 10),
    },

    /** 资源属性标签 */
    resourceAttributes: {
      ["service.name"]: process.env.APM_SERVICE_NAME || "medical-bible-api",
      ["service.version"]: process.env.APM_SERVICE_VERSION || "1.0.0",
      ["deployment.environment"]:
        process.env.APM_ENVIRONMENT || process.env.NODE_ENV || "development",
      ...(process.env.APM_ADDITIONAL_LABELS
        ? JSON.parse(process.env.APM_ADDITIONAL_LABELS)
        : {}),
    },
  };
});

/**
 * 创建资源标签
 * @description 根据 APM 配置创建 OpenTelemetry 资源标签
 */
export function createResourceAttributes(customLabels?: Record<string, string>): Record<string, string> {
  const config = apmConfig();

  return {
    ...config.resourceAttributes,
    ...customLabels,
  };
}
