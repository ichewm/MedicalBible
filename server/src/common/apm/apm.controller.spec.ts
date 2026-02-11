/**
 * @file Unit Test: APM Controller (REL-006)
 * @description Unit tests for ApmController verifying status endpoints
 *
 * Spec Requirements (from PRD REL-006):
 * 1. APM status query endpoint
 * 2. Health check endpoint for APM
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { HttpCode, HttpStatus } from "@nestjs/common";
import { ApmController, ApmResponse } from "./apm.controller";
import { ApmService, ApmStatus } from "./apm.service";
import { ApmServiceType } from "../../config/apm.config";

describe("ApmController Unit Tests (REL-006)", () => {
  let controller: ApmController;
  let apmService: ApmService;

  /**
   * Setup: Initialize controller with mocked service
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApmController],
      providers: [
        {
          provide: ApmService,
          useValue: {
            getStatus: jest.fn(() => ({
              enabled: true,
              tracingEnabled: true,
              metricsEnabled: true,
              serviceName: "test-service",
              serviceType: ApmServiceType.CONSOLE,
              sampleRate: 1.0,
            })),
          },
        },
      ],
    }).compile();

    controller = module.get<ApmController>(ApmController);
    apmService = module.get<ApmService>(ApmService);
  });

  /**
   * Test: Controller initialization
   */
  describe("test_unit_initialization", () => {
    it("should be defined", () => {
      expect(controller).toBeDefined();
    });
  });

  /**
   * Test: Status endpoint
   *
   * Spec Requirement: APM status query
   * Expected: Should return current APM configuration and runtime stats
   */
  describe("test_unit_status_endpoint", () => {
    it("should return APM status", () => {
      const result = controller.getStatus();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.memory).toBeDefined();
      expect(result.cpu).toBeDefined();
    });

    it("should include service status in response", () => {
      const mockStatus: ApmStatus = {
        enabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        serviceName: "test-service",
        serviceType: ApmServiceType.CONSOLE,
        sampleRate: 1.0,
      };

      jest.spyOn(apmService, "getStatus").mockReturnValue(mockStatus);

      const result = controller.getStatus();

      expect(result.status).toEqual(mockStatus);
      expect(result.status.enabled).toBe(true);
      expect(result.status.tracingEnabled).toBe(true);
      expect(result.status.metricsEnabled).toBe(true);
      expect(result.status.serviceName).toBe("test-service");
    });

    it("should include runtime statistics", () => {
      const result = controller.getStatus();

      // Check uptime
      expect(typeof result.uptime).toBe("number");
      expect(result.uptime).toBeGreaterThan(0);

      // Check memory stats
      expect(typeof result.memory.rss).toBe("number");
      expect(typeof result.memory.heapTotal).toBe("number");
      expect(typeof result.memory.heapUsed).toBe("number");
      expect(typeof result.memory.external).toBe("number");

      // Check CPU stats
      expect(typeof result.cpu.user).toBe("number");
      expect(typeof result.cpu.system).toBe("number");
    });
  });

  /**
   * Test: Health check endpoint
   *
   * Spec Requirement: APM health check
   * Expected: Should return healthy status
   */
  describe("test_unit_health_endpoint", () => {
    it("should return health check result", () => {
      const result = controller.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe("ok");
      expect(result.apm).toBeDefined();
    });

    it("should indicate APM is enabled when enabled", () => {
      jest.spyOn(apmService, "getStatus").mockReturnValue({
        enabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        serviceName: "test-service",
        serviceType: ApmServiceType.CONSOLE,
        sampleRate: 1.0,
      });

      const result = controller.healthCheck();

      expect(result.apm).toBe("enabled");
    });

    it("should indicate APM is disabled when disabled", () => {
      jest.spyOn(apmService, "getStatus").mockReturnValue({
        enabled: false,
        tracingEnabled: false,
        metricsEnabled: false,
        serviceName: "test-service",
        serviceType: ApmServiceType.CONSOLE,
        sampleRate: 0,
      });

      const result = controller.healthCheck();

      expect(result.apm).toBe("disabled");
    });
  });

  /**
   * Test: Response structure
   */
  describe("test_unit_response_structure", () => {
    it("should return properly structured APM response", () => {
      jest.spyOn(apmService, "getStatus").mockReturnValue({
        enabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        serviceName: "medical-bible-api",
        serviceType: ApmServiceType.OTLP,
        sampleRate: 0.1,
      });

      const result = controller.getStatus();

      // Verify response structure matches ApmResponse interface
      expect(result).toMatchObject({
        status: expect.objectContaining({
          enabled: expect.any(Boolean),
          tracingEnabled: expect.any(Boolean),
          metricsEnabled: expect.any(Boolean),
          serviceName: expect.any(String),
          serviceType: expect.any(String),
          sampleRate: expect.any(Number),
        }),
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
        }),
        cpu: expect.objectContaining({
          user: expect.any(Number),
          system: expect.any(Number),
        }),
      });
    });
  });
});
