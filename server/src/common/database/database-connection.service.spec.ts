/**
 * @file Database Connection Service Unit Tests
 * @description Unit tests for DatabaseConnectionService
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseConnectionService } from "./database-connection.service";
import { DataSource, QueryRunner } from "typeorm";
import { ConfigService } from "@nestjs/config";

describe("DatabaseConnectionService", () => {
  let service: DatabaseConnectionService;
  let dataSource: DataSource;
  let configService: ConfigService;

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
    },
  } as any;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseConnectionService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DatabaseConnectionService>(DatabaseConnectionService);
    dataSource = module.get<DataSource>(DataSource);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup default mock behavior
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockConfigService.get.mockReturnValue(60000); // 60 second default timeout
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("executeWithRetry", () => {
    it("should execute query successfully on first attempt", async () => {
      const mockCallback = jest.fn().mockResolvedValue("success");

      const result = await service.executeWithRetry(mockCallback);

      expect(result).toBe("success");
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it("should retry on connection timeout error", async () => {
      const timeoutError = new Error("Connection timeout");
      let attemptCount = 0;
      const mockCallback = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw timeoutError;
        }
        return Promise.resolve("success");
      });

      const result = await service.executeWithRetry(mockCallback);

      expect(result).toBe("success");
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("should retry on deadlock error", async () => {
      const deadlockError = new Error("Deadlock found when trying to get lock");
      let attemptCount = 0;
      const mockCallback = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw deadlockError;
        }
        return Promise.resolve("success");
      });

      const result = await service.executeWithRetry(mockCallback, {
        maxRetries: 2,
      });

      expect(result).toBe("success");
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable error", async () => {
      const normalError = new Error("Unique constraint violation");
      const mockCallback = jest.fn().mockRejectedValue(normalError);

      await expect(service.executeWithRetry(mockCallback)).rejects.toThrow(
        "Unique constraint violation",
      );

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it("should respect custom maxRetries option", async () => {
      const timeoutError = new Error("Connection timeout");
      const mockCallback = jest.fn().mockRejectedValue(timeoutError);

      await expect(
        service.executeWithRetry(mockCallback, { maxRetries: 1 }),
      ).rejects.toThrow("Connection timeout");

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it("should timeout after specified timeoutMs", async () => {
      const mockCallback = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("success"), 10000); // 10 second delay
          }),
      );

      await expect(
        service.executeWithRetry(mockCallback, {
          timeoutMs: 100, // 100ms timeout
          maxRetries: 1,
        }),
      ).rejects.toThrow("Database operation timed out");
    });

    it("should use exponential backoff by default", async () => {
      const timeoutError = new Error("Connection timeout");
      const mockCallback = jest.fn().mockRejectedValue(timeoutError);
      const startTime = Date.now();

      await expect(
        service.executeWithRetry(mockCallback, {
          maxRetries: 3,
          baseDelayMs: 50,
        }),
      ).rejects.toThrow();

      const elapsed = Date.now() - startTime;
      // With exponential backoff: 50 + 100 = 150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(140);
    });
  });

  describe("executeQueryWithRetry", () => {
    it("should execute SQL query with parameters", async () => {
      const mockResult = [{ id: 1, name: "test" }];
      mockDataSource.query.mockResolvedValue(mockResult);

      const result = await service.executeQueryWithRetry(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );

      expect(result).toEqual(mockResult);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
    });

    it("should retry query on connection error", async () => {
      const error = new Error("Connection lost");
      let attemptCount = 0;
      mockDataSource.query.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(error);
        }
        return Promise.resolve([{ id: 1 }]);
      });

      const result = await service.executeQueryWithRetry("SELECT * FROM users");

      expect(result).toEqual([{ id: 1 }]);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });
  });

  describe("executeTransactionWithRetry", () => {
    it("should execute transaction successfully", async () => {
      const mockResult = { userId: 1, orderId: 2 };
      const mockCallback = jest.fn().mockResolvedValue(mockResult);

      const result = await service.executeTransactionWithRetry(mockCallback);

      expect(result).toEqual(mockResult);
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const error = new Error("Transaction failed");
      const mockCallback = jest.fn().mockRejectedValue(error);

      await expect(
        service.executeTransactionWithRetry(mockCallback),
      ).rejects.toThrow("Transaction failed");

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should retry transaction on deadlock", async () => {
      const deadlockError = new Error("Deadlock found when trying to get lock");
      let attemptCount = 0;
      const mockCallback = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw deadlockError;
        }
        return Promise.resolve({ success: true });
      });

      const result = await service.executeTransactionWithRetry(mockCallback, {
        maxRetries: 2,
      });

      expect(result).toEqual({ success: true });
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("should release query runner even if commit fails", async () => {
      const error = new Error("Commit failed");
      mockQueryRunner.commitTransaction.mockRejectedValue(error);
      const mockCallback = jest.fn().mockResolvedValue({ success: true });

      await expect(
        service.executeTransactionWithRetry(mockCallback, { maxRetries: 1 }),
      ).rejects.toThrow("Commit failed");

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should timeout long-running transaction", async () => {
      const mockCallback = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 10000);
          }),
      );

      await expect(
        service.executeTransactionWithRetry(mockCallback, {
          timeoutMs: 100,
          maxRetries: 1,
        }),
      ).rejects.toThrow("Database operation timed out");
    });
  });

  describe("getConnectionStats", () => {
    it("should return connection statistics", () => {
      const stats = service.getConnectionStats();

      expect(stats).toHaveProperty("defaultTimeout");
      expect(stats).toHaveProperty("maxRetries");
      expect(stats).toHaveProperty("baseDelay");
      expect(stats.defaultTimeout).toBe(60000);
      expect(stats.maxRetries).toBe(3);
    });
  });
});
