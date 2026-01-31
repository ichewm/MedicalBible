/**
 * @file API 响应 DTO 单元测试
 * @description 测试标准 API 响应 DTO 的结构和属性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiResponseDto, PaginatedResponseDto } from "./api-response.dto";

describe("ApiResponseDto", () => {
  describe("基本属性", () => {
    it("应包含所有必需的属性", () => {
      const apiResponse: ApiResponseDto<{ id: number }> = {
        code: 200,
        message: "success",
        data: { id: 1 },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.code).toBe(200);
      expect(apiResponse.message).toBe("success");
      expect(apiResponse.data).toEqual({ id: 1 });
      expect(apiResponse.timestamp).toBe("2024-01-15T10:30:00.000Z");
    });

    it("应支持泛型类型的数据", () => {
      type UserData = {
        id: number;
        name: string;
        email: string;
      };

      const apiResponse: ApiResponseDto<UserData> = {
        code: 200,
        message: "success",
        data: {
          id: 1,
          name: "测试用户",
          email: "test@example.com",
        },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data.id).toBe(1);
      expect(apiResponse.data.name).toBe("测试用户");
      expect(apiResponse.data.email).toBe("test@example.com");
    });

    it("应支持数组类型的数据", () => {
      const apiResponse: ApiResponseDto<number[]> = {
        code: 200,
        message: "success",
        data: [1, 2, 3, 4, 5],
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data).toEqual([1, 2, 3, 4, 5]);
      expect(apiResponse.data).toHaveLength(5);
    });

    it("应支持对象数组类型的数据", () => {
      type Item = { id: number; name: string };

      const apiResponse: ApiResponseDto<Item[]> = {
        code: 200,
        message: "success",
        data: [
          { id: 1, name: "项目1" },
          { id: 2, name: "项目2" },
        ],
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data).toHaveLength(2);
      expect(apiResponse.data[0].name).toBe("项目1");
    });
  });

  describe("常见响应场景", () => {
    it("应表示成功的创建响应", () => {
      const apiResponse: ApiResponseDto<{ id: number }> = {
        code: 200,
        message: "success",
        data: { id: 123 },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.code).toBe(200);
      expect(apiResponse.data.id).toBe(123);
    });

    it("应表示成功的更新响应", () => {
      const apiResponse: ApiResponseDto<{ id: number; updated: boolean }> = {
        code: 200,
        message: "success",
        data: { id: 123, updated: true },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data.updated).toBe(true);
    });

    it("应表示成功的删除响应", () => {
      const apiResponse: ApiResponseDto<{ deleted: boolean }> = {
        code: 200,
        message: "success",
        data: { deleted: true },
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data.deleted).toBe(true);
    });

    it("应表示查询列表响应", () => {
      const apiResponse: ApiResponseDto<string[]> = {
        code: 200,
        message: "success",
        data: ["item1", "item2", "item3"],
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data).toHaveLength(3);
    });

    it("应支持空数据响应", () => {
      const apiResponse: ApiResponseDto<null> = {
        code: 200,
        message: "success",
        data: null,
        timestamp: "2024-01-15T10:30:00.000Z",
      };

      expect(apiResponse.data).toBeNull();
    });
  });
});

describe("PaginatedResponseDto", () => {
  describe("基本属性", () => {
    it("应包含所有必需的属性", () => {
      type Item = { id: number; name: string };

      const paginatedResponse: PaginatedResponseDto<Item> = {
        items: [
          { id: 1, name: "项目1" },
          { id: 2, name: "项目2" },
        ],
        total: 100,
        page: 1,
        pageSize: 10,
        totalPages: 10,
        hasNext: true,
      };

      expect(paginatedResponse.items).toHaveLength(2);
      expect(paginatedResponse.total).toBe(100);
      expect(paginatedResponse.page).toBe(1);
      expect(paginatedResponse.pageSize).toBe(10);
      expect(paginatedResponse.totalPages).toBe(10);
      expect(paginatedResponse.hasNext).toBe(true);
    });

    it("应正确计算总页数", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: [],
        total: 100,
        page: 1,
        pageSize: 10,
        totalPages: 10,
        hasNext: true,
      };

      // 100 条记录，每页 10 条，共 10 页
      expect(paginatedResponse.totalPages).toBe(10);
    });

    it("应正确判断是否有下一页", () => {
      // 第一页，应该有下一页
      const page1: PaginatedResponseDto<{ id: number }> = {
        items: [],
        total: 25,
        page: 1,
        pageSize: 10,
        totalPages: 3,
        hasNext: true,
      };
      expect(page1.hasNext).toBe(true);

      // 最后一页，不应该有下一页
      const lastPage: PaginatedResponseDto<{ id: number }> = {
        items: [],
        total: 25,
        page: 3,
        pageSize: 10,
        totalPages: 3,
        hasNext: false,
      };
      expect(lastPage.hasNext).toBe(false);
    });
  });

  describe("边界情况", () => {
    it("应处理空结果集", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        hasNext: false,
      };

      expect(paginatedResponse.items).toHaveLength(0);
      expect(paginatedResponse.total).toBe(0);
      expect(paginatedResponse.totalPages).toBe(0);
      expect(paginatedResponse.hasNext).toBe(false);
    });

    it("应处理单页结果", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        total: 3,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        hasNext: false,
      };

      expect(paginatedResponse.totalPages).toBe(1);
      expect(paginatedResponse.hasNext).toBe(false);
    });

    it("应处理正好整除的情况", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: [],
        total: 100,
        page: 10,
        pageSize: 10,
        totalPages: 10,
        hasNext: false,
      };

      // 100 条记录，每页 10 条，共 10 页
      expect(paginatedResponse.totalPages).toBe(10);
      expect(paginatedResponse.hasNext).toBe(false);
    });
  });

  describe("不同页码", () => {
    it("应正确表示第一页", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })),
        total: 100,
        page: 1,
        pageSize: 10,
        totalPages: 10,
        hasNext: true,
      };

      expect(paginatedResponse.page).toBe(1);
      expect(paginatedResponse.hasNext).toBe(true);
    });

    it("应正确表示中间页", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: Array.from({ length: 10 }, (_, i) => ({ id: i + 11 })),
        total: 100,
        page: 2,
        pageSize: 10,
        totalPages: 10,
        hasNext: true,
      };

      expect(paginatedResponse.page).toBe(2);
      expect(paginatedResponse.hasNext).toBe(true);
    });

    it("应正确表示最后一页", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: Array.from({ length: 10 }, (_, i) => ({ id: i + 91 })),
        total: 100,
        page: 10,
        pageSize: 10,
        totalPages: 10,
        hasNext: false,
      };

      expect(paginatedResponse.page).toBe(10);
      expect(paginatedResponse.hasNext).toBe(false);
    });
  });

  describe("不同页大小", () => {
    it("应支持小页大小", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: [{ id: 1 }, { id: 2 }],
        total: 20,
        page: 1,
        pageSize: 2,
        totalPages: 10,
        hasNext: true,
      };

      expect(paginatedResponse.pageSize).toBe(2);
      expect(paginatedResponse.totalPages).toBe(10);
    });

    it("应支持大页大小", () => {
      const paginatedResponse: PaginatedResponseDto<{ id: number }> = {
        items: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })),
        total: 500,
        page: 1,
        pageSize: 100,
        totalPages: 5,
        hasNext: true,
      };

      expect(paginatedResponse.pageSize).toBe(100);
      expect(paginatedResponse.totalPages).toBe(5);
    });
  });
});
