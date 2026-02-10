/**
 * @file Transaction Service Unit Tests
 * @description Unit tests for TransactionService
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { TransactionService, IsolationLevel } from "./transaction.service";
import { DataSource, QueryRunner, Repository } from "typeorm";
import { Logger } from "@nestjs/common";

describe("TransactionService", () => {
  let service: TransactionService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
  } as any; // Cast to any to avoid TypeScript issues with partial mock

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    dataSource = module.get<DataSource>(DataSource);

    // Reset mocks and restore default behavior before each test
    jest.clearAllMocks();
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    // Setup default mock behavior
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.manager.getRepository.mockReturnValue({
      save: jest.fn(),
      findOne: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("runInTransaction", () => {
    it("should commit transaction on success", async () => {
      const mockCallback = jest.fn().mockResolvedValue("success");

      const result = await service.runInTransaction(mockCallback);

      expect(result).toBe("success");
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const mockError = new Error("Test error");
      const mockCallback = jest.fn().mockRejectedValue(mockError);

      await expect(service.runInTransaction(mockCallback)).rejects.toThrow(
        "Test error",
      );

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should release query runner even if commit fails", async () => {
      const mockError = new Error("Commit failed");
      mockQueryRunner.commitTransaction.mockRejectedValue(mockError);
      const mockCallback = jest.fn().mockResolvedValue("success");

      await expect(service.runInTransaction(mockCallback)).rejects.toThrow(
        "Commit failed",
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should support custom isolation level", async () => {
      const mockCallback = jest.fn().mockResolvedValue("success");
      const isolationLevel = IsolationLevel.SERIALIZABLE;

      await service.runInTransaction(mockCallback, { isolationLevel });

      expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith(
        isolationLevel,
      );
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

      const result = await service.runInTransaction(mockCallback, {
        maxRetries: 2,
      });

      expect(result).toBe("success");
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-deadlock error", async () => {
      const normalError = new Error("Normal error");
      const mockCallback = jest.fn().mockRejectedValue(normalError);

      await expect(service.runInTransaction(mockCallback)).rejects.toThrow(
        "Normal error",
      );

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("getRepository", () => {
    it("should return repository from query runner", () => {
      class MockEntity {
        id: number;
      }

      const mockRepo = { save: jest.fn() };
      mockQueryRunner.manager.getRepository.mockReturnValue(mockRepo);

      const result = service.getRepository(mockQueryRunner, MockEntity);

      expect(mockQueryRunner.manager.getRepository).toHaveBeenCalledWith(
        MockEntity,
      );
      expect(result).toBe(mockRepo);
    });
  });

  describe("runAtomic", () => {
    it("should execute atomic operations", async () => {
      const mockOperations = jest.fn().mockResolvedValue("atomic result");

      const result = await service.runAtomic(mockOperations);

      expect(result).toBe("atomic result");
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("savepoint operations", () => {
    it("should create savepoint", async () => {
      mockQueryRunner.query = jest.fn().mockResolvedValue(undefined);

      await service.createSavepoint(mockQueryRunner, "test_savepoint");

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        "SAVEPOINT test_savepoint",
      );
    });

    it("should rollback to savepoint", async () => {
      mockQueryRunner.query = jest.fn().mockResolvedValue(undefined);

      await service.rollbackToSavepoint(mockQueryRunner, "test_savepoint");

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        "ROLLBACK TO SAVEPOINT test_savepoint",
      );
    });

    it("should release savepoint", async () => {
      mockQueryRunner.query = jest.fn().mockResolvedValue(undefined);

      await service.releaseSavepoint(mockQueryRunner, "test_savepoint");

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        "RELEASE SAVEPOINT test_savepoint",
      );
    });
  });
});
