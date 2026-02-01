/**
 * @file 分页功能集成测试
 * @description 测试分页 DTO 和分页响应的集成，验证分页行为符合规范要求
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: ../prd.md (PERF-003)
 * - 创建可复用的分页 DTO
 * - 为所有列表端点添加分页参数
 * - 实现基于偏移量的分页（对于大数据集，偏移分页足够）
 * - 在响应中添加总计数元数据
 *
 * 集成测试与单元测试的区别：
 * - 单元测试验证单个类/方法的逻辑
 * - 集成测试验证组件间的实际交互行为
 * - 本测试验证 PaginationDto、PaginatedResponseDto 与实际使用的集成
 */

import { PaginationDto } from "./api-response.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

/**
 * 集成测试: PaginationDto 的行为验证
 *
 * 这些测试验证分页 DTO 在实际使用场景中的行为
 */
describe("PaginationDto Integration Tests", () => {
  /**
   * SPEC: 可复用分页 DTO
   * 位置: ../prd.md 第 10-18 行
   * 要求: 创建可复用的分页 DTO，支持页码和每页数量参数
   */
  describe("SPEC: Reusable Pagination DTO", () => {
    it("should use default values when not provided", () => {
      const paginationDto = new PaginationDto();

      // 验证默认值: page = 1, pageSize = 20
      expect(paginationDto.page).toBe(1);
      expect(paginationDto.pageSize).toBe(20);
      expect(paginationDto.getSkip()).toBe(0); // (1 - 1) * 20 = 0
      expect(paginationDto.getTake()).toBe(20);
    });

    it("should calculate correct skip and take values", () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 3,
        pageSize: 50,
      });

      // 验证: getSkip() = (page - 1) * pageSize = (3 - 1) * 50 = 100
      expect(paginationDto.getSkip()).toBe(100);
      expect(paginationDto.getTake()).toBe(50);
    });

    it("should handle edge case: first page", () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 10,
      });

      expect(paginationDto.getSkip()).toBe(0);
      expect(paginationDto.getTake()).toBe(10);
    });

    it("should handle edge case: large page number", () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 100,
        pageSize: 20,
      });

      // 验证: 第100页的偏移量 = (100 - 1) * 20 = 1980
      expect(paginationDto.getSkip()).toBe(1980);
      expect(paginationDto.getTake()).toBe(20);
    });
  });

  /**
   * SPEC: 分页参数验证
   * 位置: server/src/common/dto/api-response.dto.ts 第 28-54 行
   * 要求: 页码必须 >= 1，每页数量必须在 1-100 之间
   */
  describe("SPEC: Pagination Parameter Validation", () => {
    it("should validate valid pagination parameters", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 2,
        pageSize: 30,
      });

      const errors = await validate(paginationDto);

      // 验证: 有效的分页参数应该通过验证
      expect(errors).toHaveLength(0);
    });

    it("should reject page less than 1", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 0,
        pageSize: 20,
      });

      const errors = await validate(paginationDto);

      // 验证: 页码 < 1 应该被拒绝
      expect(errors.length).toBeGreaterThan(0);
      const pageErrors = errors.filter((e) => e.property === "page");
      expect(pageErrors.length).toBeGreaterThan(0);
      expect(pageErrors[0].constraints?.min).toBeDefined();
    });

    it("should reject pageSize less than 1", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 0,
      });

      const errors = await validate(paginationDto);

      // 验证: pageSize < 1 应该被拒绝
      expect(errors.length).toBeGreaterThan(0);
      const pageSizeErrors = errors.filter((e) => e.property === "pageSize");
      expect(pageSizeErrors.length).toBeGreaterThan(0);
    });

    it("should reject pageSize greater than 100", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 101,
      });

      const errors = await validate(paginationDto);

      // 验证: pageSize > 100 应该被拒绝
      expect(errors.length).toBeGreaterThan(0);
      const pageSizeErrors = errors.filter((e) => e.property === "pageSize");
      expect(pageSizeErrors.length).toBeGreaterThan(0);
      expect(pageSizeErrors[0].constraints?.max).toBeDefined();
    });

    it("should accept boundary value pageSize = 100", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 100,
      });

      const errors = await validate(paginationDto);

      // 验证: pageSize = 100 (边界值) 应该被接受
      expect(errors).toHaveLength(0);
    });

    it("should accept boundary value pageSize = 1", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 1,
      });

      const errors = await validate(paginationDto);

      // 验证: pageSize = 1 (边界值) 应该被接受
      expect(errors).toHaveLength(0);
    });
  });

  /**
   * SPEC: 类型转换
   * 位置: server/src/common/dto/api-response.dto.ts 第 34-36, 50-53 行
   * 要求: 支持从字符串自动转换为数字
   */
  describe("SPEC: Type Conversion Integration", () => {
    it("should convert string query parameters to numbers", () => {
      // 模拟 HTTP 查询参数（总是字符串）
      const paginationDto = plainToInstance(PaginationDto, {
        page: "2" as unknown as number,
        pageSize: "30" as unknown as number,
      });

      // 验证: 字符串被转换为数字
      expect(typeof paginationDto.page).toBe("number");
      expect(typeof paginationDto.pageSize).toBe("number");
      expect(paginationDto.page).toBe(2);
      expect(paginationDto.pageSize).toBe(30);
      expect(paginationDto.getSkip()).toBe(30);
      expect(paginationDto.getTake()).toBe(30);
    });

    it("should handle optional parameters (undefined)", () => {
      const paginationDto = plainToInstance(PaginationDto, {});

      // 验证: 未提供的参数使用默认值
      expect(paginationDto.page).toBe(1);
      expect(paginationDto.pageSize).toBe(20);
    });
  });

  /**
   * SPEC: 继承性
   * 位置: server/src/modules/admin/dto/admin.dto.ts 第 21 行
   * 要求: 查询 DTO 可以继承 PaginationDto 并添加额外过滤条件
   */
  describe("SPEC: PaginationDto Extensibility", () => {
    // 模拟实际使用中的查询 DTO
    class UserListQueryDto extends PaginationDto {
      phone?: string;
      username?: string;
      status?: number;
    }

    it("should preserve pagination behavior in extended DTO", () => {
      const queryDto = plainToInstance(UserListQueryDto, {
        page: 2,
        pageSize: 25,
        phone: "13800138000",
        status: 1,
      });

      // 验证: 分页功能正常
      expect(queryDto.getSkip()).toBe(25);
      expect(queryDto.getTake()).toBe(25);

      // 验证: 额外过滤条件被保留
      expect(queryDto.phone).toBe("13800138000");
      expect(queryDto.status).toBe(1);
    });

    it("should use default pagination values with filters", () => {
      const queryDto = plainToInstance(UserListQueryDto, {
        phone: "13800138000",
      });

      // 验证: 只提供过滤条件时，分页使用默认值
      expect(queryDto.page).toBe(1);
      expect(queryDto.pageSize).toBe(20);
      expect(queryDto.phone).toBe("13800138000");
    });
  });

  /**
   * SPEC: 分页计算准确性
   * 位置: server/src/common/dto/api-response.dto.ts 第 68-86 行
   * 要求: getSkip() 和 getTake() 方法必须返回正确的 TypeORM 查询参数
   */
  describe("SPEC: Pagination Calculation Accuracy", () => {
    const testCases = [
      { page: 1, pageSize: 10, expectedSkip: 0, expectedTake: 10 },
      { page: 2, pageSize: 10, expectedSkip: 10, expectedTake: 10 },
      { page: 5, pageSize: 20, expectedSkip: 80, expectedTake: 20 },
      { page: 10, pageSize: 50, expectedSkip: 450, expectedTake: 50 },
      { page: 1, pageSize: 100, expectedSkip: 0, expectedTake: 100 },
    ];

    test.each(testCases)(
      "should calculate correct skip/take for page=$page, pageSize=$pageSize",
      ({ page, pageSize, expectedSkip, expectedTake }) => {
        const paginationDto = plainToInstance(PaginationDto, { page, pageSize });

        expect(paginationDto.getSkip()).toBe(expectedSkip);
        expect(paginationDto.getTake()).toBe(expectedTake);
      },
    );
  });

  /**
   * SPEC: 与 class-validator 集成
   * 位置: server/src/common/dto/api-response.dto.ts 第 10 行
   * 要求: 分页 DTO 应该与 NestJS 的验证管道无缝集成
   */
  describe("SPEC: Class-Validator Integration", () => {
    it("should provide clear error messages for invalid page", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: -1,
        pageSize: 20,
      });

      const errors = await validate(paginationDto);
      const pageErrors = errors.filter((e) => e.property === "page");

      // 验证: 提供清晰的错误消息
      expect(pageErrors[0].constraints?.min).toContain("页码最小为1");
    });

    it("should provide clear error messages for invalid pageSize", async () => {
      const paginationDto = plainToInstance(PaginationDto, {
        page: 1,
        pageSize: 101,
      });

      const errors = await validate(paginationDto);
      const pageSizeErrors = errors.filter((e) => e.property === "pageSize");

      // 验证: 提供清晰的错误消息
      expect(pageSizeErrors[0].constraints?.max).toContain("每页数量最大为100");
    });
  });
});
