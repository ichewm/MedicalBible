/**
 * @file Excel 导出服务
 * @description 提供数据导出为 Excel 文件的功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import * as XLSX from "xlsx";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * 将数据导出为 Excel Buffer
   * @param data - 数据数组
   * @param columns - 列配置
   * @param sheetName - 工作表名称
   * @returns Excel 文件 Buffer
   */
  exportToExcel(
    data: Record<string, any>[],
    columns: ExportColumn[],
    sheetName: string = "Sheet1",
  ): Buffer {
    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建表头
    const headers = columns.map((col) => col.header);

    // 转换数据
    const rows = data.map((item) => {
      return columns.map((col) => {
        const value = item[col.key];
        // 处理日期
        if (value instanceof Date) {
          return value.toLocaleString("zh-CN");
        }
        // 处理 null/undefined
        if (value === null || value === undefined) {
          return "";
        }
        return value;
      });
    });

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // 设置列宽
    const colWidths = columns.map((col) => ({
      wch: col.width || 15,
    }));
    worksheet["!cols"] = colWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 生成 Buffer
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    this.logger.log(`Exported ${data.length} rows to Excel`);
    return buffer;
  }

  /**
   * 导出用户列表
   */
  exportUsers(users: any[]): Buffer {
    const columns: ExportColumn[] = [
      { header: "ID", key: "id", width: 10 },
      { header: "用户名", key: "username", width: 20 },
      { header: "手机号", key: "phone", width: 15 },
      { header: "邮箱", key: "email", width: 25 },
      { header: "角色", key: "roleName", width: 10 },
      { header: "状态", key: "statusName", width: 10 },
      { header: "注册时间", key: "createdAt", width: 20 },
      { header: "上次登录", key: "lastLoginAt", width: 20 },
    ];

    const data = users.map((u) => ({
      ...u,
      roleName: u.role === 0 ? "学员" : u.role === 1 ? "教师" : "管理员",
      statusName: u.status === 0 ? "正常" : u.status === 1 ? "封禁" : "注销中",
    }));

    return this.exportToExcel(data, columns, "用户列表");
  }

  /**
   * 导出订单列表
   */
  exportOrders(orders: any[]): Buffer {
    const columns: ExportColumn[] = [
      { header: "订单号", key: "orderNo", width: 25 },
      { header: "用户ID", key: "userId", width: 10 },
      { header: "用户名", key: "username", width: 15 },
      { header: "等级", key: "levelName", width: 20 },
      { header: "金额", key: "amount", width: 12 },
      { header: "支付方式", key: "payMethodName", width: 12 },
      { header: "状态", key: "statusName", width: 10 },
      { header: "创建时间", key: "createdAt", width: 20 },
      { header: "支付时间", key: "paidAt", width: 20 },
    ];

    const payMethodMap: Record<number, string> = {
      1: "支付宝",
      2: "微信",
      3: "PayPal",
      4: "Stripe",
    };

    const statusMap: Record<number, string> = {
      0: "待支付",
      1: "已支付",
      2: "已取消",
    };

    const data = orders.map((o) => ({
      ...o,
      levelName: o.level?.name || "",
      payMethodName: payMethodMap[o.payMethod] || "",
      statusName: statusMap[o.status] || "",
    }));

    return this.exportToExcel(data, columns, "订单列表");
  }

  /**
   * 导出佣金记录
   */
  exportCommissions(commissions: any[]): Buffer {
    const columns: ExportColumn[] = [
      { header: "ID", key: "id", width: 10 },
      { header: "受益人ID", key: "userId", width: 12 },
      { header: "来源用户ID", key: "sourceUserId", width: 12 },
      { header: "订单号", key: "orderNo", width: 25 },
      { header: "佣金金额", key: "amount", width: 12 },
      { header: "佣金比例", key: "rate", width: 10 },
      { header: "状态", key: "statusName", width: 10 },
      { header: "解冻时间", key: "unlockAt", width: 20 },
      { header: "创建时间", key: "createdAt", width: 20 },
    ];

    const data = commissions.map((c) => ({
      ...c,
      statusName: c.status === 0 ? "冻结中" : "已解冻",
    }));

    return this.exportToExcel(data, columns, "佣金记录");
  }

  /**
   * 导出提现记录
   */
  exportWithdrawals(withdrawals: any[]): Buffer {
    const columns: ExportColumn[] = [
      { header: "ID", key: "id", width: 10 },
      { header: "用户ID", key: "userId", width: 10 },
      { header: "用户名", key: "username", width: 15 },
      { header: "金额", key: "amount", width: 12 },
      { header: "收款方式", key: "accountType", width: 12 },
      { header: "收款账号", key: "accountNo", width: 25 },
      { header: "状态", key: "statusName", width: 10 },
      { header: "申请时间", key: "createdAt", width: 20 },
      { header: "处理时间", key: "processedAt", width: 20 },
    ];

    const statusMap: Record<number, string> = {
      0: "待审核",
      1: "审核通过",
      2: "打款中",
      3: "已完成",
      4: "已拒绝",
    };

    const data = withdrawals.map((w) => ({
      ...w,
      statusName: statusMap[w.status] || "",
      accountType: w.accountInfo?.type || "",
      accountNo: w.accountInfo?.account || "",
    }));

    return this.exportToExcel(data, columns, "提现记录");
  }

  /**
   * 导出统计数据（用户增长等）
   */
  exportStatistics(stats: any[], reportType: string): Buffer {
    let columns: ExportColumn[];

    switch (reportType) {
      case "user_growth":
        columns = [
          { header: "日期", key: "date", width: 15 },
          { header: "新增用户", key: "newUsers", width: 12 },
          { header: "累计用户", key: "totalUsers", width: 12 },
          { header: "DAU", key: "dau", width: 12 },
        ];
        break;
      case "sales":
        columns = [
          { header: "日期", key: "date", width: 15 },
          { header: "订单数", key: "orderCount", width: 12 },
          { header: "销售额", key: "totalAmount", width: 15 },
          { header: "支付订单数", key: "paidCount", width: 12 },
        ];
        break;
      default:
        columns = [
          { header: "项目", key: "name", width: 20 },
          { header: "数值", key: "value", width: 15 },
        ];
    }

    return this.exportToExcel(stats, columns, "统计数据");
  }
}
