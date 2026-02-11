# APM 性能监控模块

## 概述

APM (Application Performance Monitoring) 模块基于 OpenTelemetry 实现，提供分布式追踪和性能指标收集功能。该模块支持多种后端服务，包括控制台输出、OpenTelemetry Collector、Jaeger、Zipkin 等。

## 功能特性

- **分布式追踪**: 自动追踪 HTTP 请求、数据库查询、Redis 命令的调用链路
- **性能指标收集**: 收集 HTTP 请求响应时间、数据库查询耗时、Redis 命令执行时间等指标
- **慢查询/慢请求检测**: 自动检测并标记超过阈值的慢查询和慢请求
- **告警系统**: 支持自定义告警规则和 Webhook 通知
- **健康检查端点**: 提供 APM 状态查询接口

## 配置

### 环境变量

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `APM_ENABLED` | boolean | `true` | 是否启用 APM |
| `APM_SERVICE_NAME` | string | `medical-bible-api` | 服务名称 |
| `APM_SERVICE_VERSION` | string | `1.0.0` | 服务版本 |
| `APM_ENVIRONMENT` | string | `development` | 部署环境 |
| `APM_SERVICE_TYPE` | string | `console` (dev) / `otlp` (prod) | APM 后端类型 |
| `APM_OTLP_ENDPOINT` | string | `http://localhost:4317` | OTLP 端点 |
| `APM_OTLP_HEADERS` | JSON | - | OTLP 认证头部 |
| `APM_SAMPLE_RATE` | float | `1.0` (dev) / `0.1` (prod) | 采样率 (0-1) |
| `APM_TRACING_ENABLED` | boolean | `true` | 是否启用分布式追踪 |
| `APM_METRICS_ENABLED` | boolean | `true` | 是否启用指标收集 |
| `APM_METRICS_EXPORT_INTERVAL` | number | `30000` | 指标导出间隔 (毫秒) |
| `APM_DB_QUERY_THRESHOLD` | number | `1000` | 慢查询阈值 (毫秒) |
| `APM_HTTP_REQUEST_THRESHOLD` | number | `3000` | 慢请求阈值 (毫秒) |
| `APM_REDIS_COMMAND_THRESHOLD` | number | `500` | 慢 Redis 命令阈值 (毫秒) |
| `APM_ALERTS_ENABLED` | boolean | `false` | 是否启用告警 |
| `APM_ALERT_WEBHOOK_URL` | string | - | 告警 Webhook URL |
| `APM_ALERT_RULES` | JSON | - | 告警规则 (JSON 数组) |
| `APM_ALERT_THROTTLE_INTERVAL` | number | `300` | 告警限流间隔 (秒) |
| `APM_ADDITIONAL_LABELS` | JSON | - | 额外的资源标签 |

### 服务类型 (APM_SERVICE_TYPE)

- `console`: 输出到控制台 (开发环境推荐)
- `otlp`: OpenTelemetry 协议 (生产环境推荐，兼容 Collector、Jaeger、Zipkin)
- `jaeger`: Jaeger 分布式追踪系统
- `zipkin`: Zipkin 分布式追踪系统
- `datadog`: DataDog APM
- `new_relic`: New Relic APM

## 使用方法

### 1. 自动追踪

APM 模块通过 `ApmInterceptor` 自动追踪所有 HTTP 请求，无需额外代码。

### 2. 手动记录指标

```typescript
import { ApmService } from '@/common/apm';

constructor(private readonly apmService: ApmService) {}

// 记录自定义指标
this.apmService.recordMetric({
  name: 'custom_operation_count',
  value: 1,
  labels: { operation: 'export', user_id: '123' },
});

// 记录数据库查询性能
this.apmService.recordDbQuery('SELECT', 'users', 150);

// 记录 Redis 命令性能
this.apmService.recordRedisCommand('GET', 25);
```

### 3. 自定义 Span

```typescript
// 在自定义 Span 中执行代码
const result = await this.apmService.runInSpan('customOperation', async () => {
  // 这里执行的代码会被自动追踪
  return await this.someExpensiveOperation();
});
```

### 4. 获取当前 Span

```typescript
const currentSpan = this.apmService.getCurrentSpan();
if (currentSpan) {
  // 可以添加事件、属性等
  currentSpan.addEvent('custom_event', { key: 'value' });
}
```

## API 端点

### GET /apm/status

获取 APM 状态和系统资源使用情况。

**响应示例**:
```json
{
  "status": {
    "enabled": true,
    "tracingEnabled": true,
    "metricsEnabled": true,
    "serviceName": "medical-bible-api",
    "serviceType": "console",
    "sampleRate": 1.0
  },
  "uptime": 3600.5,
  "memory": {
    "rss": 150.5,
    "heapTotal": 80.0,
    "heapUsed": 45.2,
    "external": 2.5
  },
  "cpu": {
    "user": 120.5,
    "system": 45.2
  }
}
```

### GET /apm/health

APM 健康检查端点。

**响应示例**:
```json
{
  "status": "ok",
  "apm": "enabled"
}
```

## 告警配置

### 告警规则示例

```json
[
  {
    "name": "high_error_rate",
    "metric": "http_requests_total{status=~\"5..\"}",
    "threshold": 0.05,
    "operator": "gt",
    "severity": "critical"
  },
  {
    "name": "high_latency",
    "metric": "http_request_duration_milliseconds",
    "threshold": 5000,
    "operator": "gt",
    "severity": "warning"
  },
  {
    "name": "slow_db_query",
    "metric": "db_query_duration_milliseconds",
    "threshold": 3000,
    "operator": "gt",
    "severity": "warning"
  }
]
```

### 操作符说明

- `gt`: 大于
- `lt`: 小于
- `eq`: 等于
- `gte`: 大于等于
- `lte`: 小于等于

### 告警级别

- `critical`: 严重
- `warning`: 警告
- `info`: 信息

## 生产环境配置建议

### 1. 使用 OTLP 后端

```bash
APM_SERVICE_TYPE=otlp
APM_OTLP_ENDPOINT=http://your-opentelemetry-collector:4317
```

### 2. 调整采样率

生产环境建议降低采样率以减少性能影响：

```bash
APM_SAMPLE_RATE=0.1  # 10% 采样率
```

### 3. 配置告警

```bash
APM_ALERTS_ENABLED=true
APM_ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
APM_ALERT_THROTTLE_INTERVAL=300  # 5分钟限流
```

### 4. 设置合理的阈值

根据实际业务情况调整慢查询和慢请求阈值：

```bash
APM_DB_QUERY_THRESHOLD=1000       # 1秒
APM_HTTP_REQUEST_THRESHOLD=3000   # 3秒
APM_REDIS_COMMAND_THRESHOLD=500   # 500毫秒
```

## 收集的指标

### HTTP 请求指标

- `http_requests_total`: HTTP 请求总数
- `http_request_duration_milliseconds`: HTTP 请求响应时间
- `http_slow_requests_total`: 慢请求总数

### 数据库指标

- `db_queries_total`: 数据库查询总数
- `db_query_duration_milliseconds`: 数据库查询响应时间
- `db_slow_queries_total`: 慢查询总数

### Redis 指标

- `redis_commands_total`: Redis 命令总数
- `redis_command_duration_milliseconds`: Redis 命令响应时间
- `redis_slow_commands_total`: 慢 Redis 命令总数

## 故障排查

### APM 未启动

检查日志中是否有 `APM is disabled by configuration` 或 `APM initialized successfully`。

### 数据未上报

1. 检查 `APM_SERVICE_TYPE` 配置是否正确
2. 检查 OTLP 端点是否可访问
3. 查看应用日志中的错误信息

### 性能影响过大

降低采样率：`APM_SAMPLE_RATE=0.1`

## 相关文档

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [Jaeger 文档](https://www.jaegertracing.io/docs/)
- [Zipkin 文档](https://zipkin.io/pages/)
