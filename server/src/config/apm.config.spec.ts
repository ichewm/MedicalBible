/**
 * @file Unit Test: APM Configuration (REL-006)
 * @description Unit tests for APM configuration
 *
 * Spec Requirements (from PRD REL-006):
 * 1. Configurable APM service type
 * 2. Configurable sampling rate
 * 3. Configurable alert thresholds
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { apmConfig, ApmServiceType, MetricExportInterval, createResourceAttributes, AlertRule } from "./apm.config";

// Reset environment variables before each test
const originalEnv = process.env;

describe("APM Configuration Tests (REL-006)", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Test: Default configuration
   */
  describe("test_unit_default_config", () => {
    it("should load default configuration", () => {
      const config = apmConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.serviceName).toBeDefined();
      expect(config.serviceVersion).toBeDefined();
    });

    it("should have default service type", () => {
      process.env.NODE_ENV = "development";
      const config = apmConfig();

      expect(config.serviceType).toBe(ApmServiceType.CONSOLE);
    });

    it("should have production service type", () => {
      process.env.NODE_ENV = "production";
      const config = apmConfig();

      expect(config.serviceType).toBe(ApmServiceType.OTLP);
    });
  });

  /**
   * Test: Service name configuration
   */
  describe("test_unit_service_name", () => {
    it("should use default service name", () => {
      delete process.env.APM_SERVICE_NAME;
      const config = apmConfig();

      expect(config.serviceName).toBe("medical-bible-api");
    });

    it("should use custom service name from env", () => {
      process.env.APM_SERVICE_NAME = "custom-service";
      const config = apmConfig();

      expect(config.serviceName).toBe("custom-service");
    });
  });

  /**
   * Test: Sample rate configuration
   */
  describe("test_unit_sample_rate", () => {
    it("should have 100% sample rate in development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.APM_SAMPLE_RATE;
      const config = apmConfig();

      expect(config.sampleRate).toBe(1.0);
    });

    it("should have 10% sample rate in production by default", () => {
      process.env.NODE_ENV = "production";
      delete process.env.APM_SAMPLE_RATE;
      const config = apmConfig();

      expect(config.sampleRate).toBe(0.1);
    });

    it("should use custom sample rate from env", () => {
      process.env.APM_SAMPLE_RATE = "0.5";
      const config = apmConfig();

      expect(config.sampleRate).toBe(0.5);
    });
  });

  /**
   * Test: Threshold configuration
   */
  describe("test_unit_thresholds", () => {
    it("should have default HTTP request threshold", () => {
      delete process.env.APM_HTTP_REQUEST_THRESHOLD;
      const config = apmConfig();

      expect(config.httpRequestThreshold).toBe(3000);
    });

    it("should have default DB query threshold", () => {
      delete process.env.APM_DB_QUERY_THRESHOLD;
      const config = apmConfig();

      expect(config.dbQueryThreshold).toBe(1000);
    });

    it("should have default Redis command threshold", () => {
      delete process.env.APM_REDIS_COMMAND_THRESHOLD;
      const config = apmConfig();

      expect(config.redisCommandThreshold).toBe(500);
    });

    it("should use custom HTTP threshold from env", () => {
      process.env.APM_HTTP_REQUEST_THRESHOLD = "5000";
      const config = apmConfig();

      expect(config.httpRequestThreshold).toBe(5000);
    });

    it("should use custom DB threshold from env", () => {
      process.env.APM_DB_QUERY_THRESHOLD = "2000";
      const config = apmConfig();

      expect(config.dbQueryThreshold).toBe(2000);
    });
  });

  /**
   * Test: Metrics export interval
   */
  describe("test_unit_metrics_interval", () => {
    it("should have default export interval", () => {
      delete process.env.APM_METRICS_EXPORT_INTERVAL;
      const config = apmConfig();

      expect(config.metricsExportInterval).toBe(MetricExportInterval.THIRTY_SECONDS);
    });

    it("should use custom export interval from env", () => {
      process.env.APM_METRICS_EXPORT_INTERVAL = "60000";
      const config = apmConfig();

      expect(config.metricsExportInterval).toBe(60000);
    });
  });

  /**
   * Test: Alert configuration
   */
  describe("test_unit_alerts", () => {
    it("should have default alert rules", () => {
      delete process.env.APM_ALERT_RULES;
      const config = apmConfig();

      expect(config.alerts.rules).toBeDefined();
      expect(config.alerts.rules.length).toBeGreaterThan(0);
    });

    it("should have disabled alerts by default", () => {
      process.env.APM_ALERTS_ENABLED = "false";
      const config = apmConfig();

      expect(config.alerts.enabled).toBe(false);
    });

    it("should enable alerts when configured", () => {
      process.env.APM_ALERTS_ENABLED = "true";
      const config = apmConfig();

      expect(config.alerts.enabled).toBe(true);
    });

    it("should parse custom alert rules from env", () => {
      const customRules: AlertRule[] = [
        {
          name: "custom_alert",
          metric: "test_metric",
          threshold: 100,
          operator: "gt",
          severity: "critical",
        },
      ];
      process.env.APM_ALERT_RULES = JSON.stringify(customRules);
      const config = apmConfig();

      expect(config.alerts.rules).toEqual(customRules);
    });

    it("should have default throttle interval", () => {
      delete process.env.APM_ALERT_THROTTLE_INTERVAL;
      const config = apmConfig();

      expect(config.alerts.throttleInterval).toBe(300);
    });
  });

  /**
   * Test: Resource attributes
   */
  describe("test_unit_resource_attributes", () => {
    it("should create default resource attributes", () => {
      const attrs = createResourceAttributes();

      expect(attrs).toBeDefined();
      expect(attrs["service.name"]).toBeDefined();
      expect(attrs["service.version"]).toBeDefined();
      expect(attrs["deployment.environment"]).toBeDefined();
    });

    it("should merge custom labels", () => {
      const customLabels = {
        "custom.label": "custom_value",
        "another.label": "another_value",
      };
      const attrs = createResourceAttributes(customLabels);

      expect(attrs["custom.label"]).toBe("custom_value");
      expect(attrs["another.label"]).toBe("another_value");
      expect(attrs["service.name"]).toBeDefined(); // Default preserved
    });

    it("should include additional labels from env", () => {
      process.env.APM_ADDITIONAL_LABELS = JSON.stringify({
        "region": "us-west-1",
        "zone": "1a",
      });
      const config = apmConfig();

      expect(config.resourceAttributes["region"]).toBe("us-west-1");
      expect(config.resourceAttributes["zone"]).toBe("1a");
    });
  });

  /**
   * Test: Feature flags
   */
  describe("test_unit_feature_flags", () => {
    it("should have tracing enabled by default", () => {
      delete process.env.APM_TRACING_ENABLED;
      const config = apmConfig();

      expect(config.tracingEnabled).toBe(true);
    });

    it("should have metrics enabled by default", () => {
      delete process.env.APM_METRICS_ENABLED;
      const config = apmConfig();

      expect(config.metricsEnabled).toBe(true);
    });

    it("should disable tracing when configured", () => {
      process.env.APM_TRACING_ENABLED = "false";
      const config = apmConfig();

      expect(config.tracingEnabled).toBe(false);
    });

    it("should disable metrics when configured", () => {
      process.env.APM_METRICS_ENABLED = "false";
      const config = apmConfig();

      expect(config.metricsEnabled).toBe(false);
    });

    it("should be enabled by default", () => {
      delete process.env.APM_ENABLED;
      const config = apmConfig();

      expect(config.enabled).toBe(true);
    });

    it("should disable when APM_ENABLED is false", () => {
      process.env.APM_ENABLED = "false";
      const config = apmConfig();

      expect(config.enabled).toBe(false);
    });
  });
});
