/**
 * @file API 响应 DTO 单元测试
 * @description 测试标准 API 响应 DTO 的结构和属性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiResponseDto, PaginatedResponseDto, PaginationDto, CursorPaginationDto } from "./api-response.dto";

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

describe("PaginationDto", () => {
  describe("默认值", () => {
    it("应使用默认的分页参数", () => {
      const pagination = new PaginationDto();

      expect(pagination.page).toBe(1);
      expect(pagination.pageSize).toBe(20);
    });

    it("应允许自定义分页参数", () => {
      const pagination = new PaginationDto();
      pagination.page = 3;
      pagination.pageSize = 50;

      expect(pagination.page).toBe(3);
      expect(pagination.pageSize).toBe(50);
    });
  });

  describe("getSkip 方法", () => {
    it("应正确计算第一页的 skip 值", () => {
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 20;

      expect(pagination.getSkip()).toBe(0);
    });

    it("应正确计算第二页的 skip 值", () => {
      const pagination = new PaginationDto();
      pagination.page = 2;
      pagination.pageSize = 20;

      expect(pagination.getSkip()).toBe(20);
    });

    it("应正确计算第三页的 skip 值", () => {
      const pagination = new PaginationDto();
      pagination.page = 3;
      pagination.pageSize = 50;

      expect(pagination.getSkip()).toBe(100);
    });

    it("应使用默认值处理未定义的页码", () => {
      const pagination = new PaginationDto();
      pagination.page = undefined as unknown as number;
      pagination.pageSize = 20;

      expect(pagination.getSkip()).toBe(0);
    });

    it("应使用默认值处理未定义的每页数量", () => {
      const pagination = new PaginationDto();
      pagination.page = 2;
      pagination.pageSize = undefined as unknown as number;

      expect(pagination.getSkip()).toBe(20);
    });
  });

  describe("getTake 方法", () => {
    it("应返回正确的每页数量", () => {
      const pagination = new PaginationDto();
      pagination.pageSize = 50;

      expect(pagination.getTake()).toBe(50);
    });

    it("应使用默认值处理未定义的每页数量", () => {
      const pagination = new PaginationDto();
      pagination.pageSize = undefined as unknown as number;

      expect(pagination.getTake()).toBe(20);
    });
  });

  describe("边界情况", () => {
    it("应处理最小页码", () => {
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 10;

      expect(pagination.getSkip()).toBe(0);
    });

    it("应处理大页码", () => {
      const pagination = new PaginationDto();
      pagination.page = 1000;
      pagination.pageSize = 100;

      expect(pagination.getSkip()).toBe(99900);
    });

    it("应处理最小每页数量", () => {
      const pagination = new PaginationDto();
      pagination.pageSize = 1;

      expect(pagination.getTake()).toBe(1);
    });

    it("应处理最大每页数量", () => {
      const pagination = new PaginationDto();
      pagination.pageSize = 100;

      expect(pagination.getTake()).toBe(100);
    });
  });

  describe("继承使用", () => {
    it("应支持继承扩展其他查询参数", () => {
      class UserQueryDto extends PaginationDto {
        role?: string;
        search?: string;
      }

      const query = new UserQueryDto();
      query.page = 2;
      query.pageSize = 30;
      query.role = "admin";
      query.search = "test";

      expect(query.getSkip()).toBe(30);
      expect(query.getTake()).toBe(30);
      expect(query.role).toBe("admin");
      expect(query.search).toBe("test");
    });
  });
});

describe("CursorPaginationDto", () => {
  describe("默认值", () => {
    it("应使用默认的分页参数", () => {
      const pagination = new CursorPaginationDto();

      expect(pagination.pageSize).toBe(20);
      expect(pagination.cursor).toBeUndefined();
    });

    it("应允许自定义分页参数", () => {
      const pagination = new CursorPaginationDto();
      pagination.pageSize = 50;
      pagination.cursor = "test-cursor";

      expect(pagination.pageSize).toBe(50);
      expect(pagination.cursor).toBe("test-cursor");
    });
  });

  describe("getTake 方法", () => {
    it("应返回正确的每页数量", () => {
      const pagination = new CursorPaginationDto();
      pagination.pageSize = 50;

      expect(pagination.getTake()).toBe(50);
    });

    it("应使用默认值处理未定义的每页数量", () => {
      const pagination = new CursorPaginationDto();
      pagination.pageSize = undefined as unknown as number;

      expect(pagination.getTake()).toBe(20);
    });
  });

  describe("decodeCursor 方法", () => {
    it("应正确解码有效的 Base64 光标", () => {
      const originalData = { id: 123, createdAt: "2024-01-15T10:30:00.000Z" };
      const encodedCursor = Buffer.from(JSON.stringify(originalData)).toString("base64");

      const pagination = new CursorPaginationDto();
      pagination.cursor = encodedCursor;

      const decoded = pagination.decodeCursor();
      expect(decoded).toEqual(originalData);
    });

    it("应解码包含 ID 的简单光标", () => {
      const originalData = { id: 123 };
      const encodedCursor = Buffer.from(JSON.stringify(originalData)).toString("base64");

      const pagination = new CursorPaginationDto();
      pagination.cursor = encodedCursor;

      const decoded = pagination.decodeCursor();
      expect(decoded).toEqual({ id: 123 });
    });

    it("应在光标为空时返回 null", () => {
      const pagination = new CursorPaginationDto();
      pagination.cursor = undefined as unknown as string;

      const decoded = pagination.decodeCursor();
      expect(decoded).toBeNull();
    });

    it("应在解码无效的 Base64 时返回 null", () => {
      const pagination = new CursorPaginationDto();
      pagination.cursor = "not-valid-base64!!!";

      const decoded = pagination.decodeCursor();
      expect(decoded).toBeNull();
    });

    it("应在解码无效的 JSON 时返回 null", () => {
      const invalidJson = Buffer.from("not-valid-json").toString("base64");

      const pagination = new CursorPaginationDto();
      pagination.cursor = invalidJson;

      const decoded = pagination.decodeCursor();
      expect(decoded).toBeNull();
    });

    it("应解码包含多个字段的光标", () => {
      const originalData = { id: 123, userId: 456, createdAt: "2024-01-15" };
      const encodedCursor = Buffer.from(JSON.stringify(originalData)).toString("base64");

      const pagination = new CursorPaginationDto();
      pagination.cursor = encodedCursor;

      const decoded = pagination.decodeCursor();
      expect(decoded).toEqual(originalData);
    });
  });

  describe("边界情况", () => {
    it("应处理最小每页数量", () => {
      const pagination = new CursorPaginationDto();
      pagination.pageSize = 1;

      expect(pagination.getTake()).toBe(1);
    });

    it("应处理最大每页数量", () => {
      const pagination = new CursorPaginationDto();
      pagination.pageSize = 100;

      expect(pagination.getTake()).toBe(100);
    });

    it("应处理空字符串光标", () => {
      const pagination = new CursorPaginationDto();
      pagination.cursor = "";

      const decoded = pagination.decodeCursor();
      expect(decoded).toBeNull();
    });
  });

  describe("继承使用", () => {
    it("应支持继承扩展其他查询参数", () => {
      class UserQueryDto extends CursorPaginationDto {
        role?: string;
        search?: string;
      }

      const query = new UserQueryDto();
      query.pageSize = 30;
      query.cursor = "eyJpZCI6MTIzfQ";
      query.role = "admin";
      query.search = "test";

      expect(query.getTake()).toBe(30);
      expect(query.cursor).toBe("eyJpZCI6MTIzfQ");
      expect(query.role).toBe("admin");
      expect(query.search).toBe("test");
    });
  });
});
