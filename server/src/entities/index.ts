/**
 * @file 实体导出索引
 * @description 统一导出所有数据库实体
 * @author Medical Bible Team
 * @version 1.0.0
 */

// ==================== 用户与鉴权 ====================
export * from "./user.entity";
export * from "./user-device.entity";
export * from "./verification-code.entity";
export * from "./system-config.entity";

// ==================== SKU 核心架构 ====================
export * from "./profession.entity";
export * from "./level.entity";
export * from "./subject.entity";
export * from "./sku-price.entity";

// ==================== 题库系统 ====================
export * from "./paper.entity";
export * from "./question.entity";
export * from "./user-answer.entity";
export * from "./user-wrong-book.entity";
export * from "./exam-session.entity";

// ==================== 讲义与重点 ====================
export * from "./lecture.entity";
export * from "./lecture-highlight.entity";
export * from "./reading-progress.entity";

// ==================== 订单与支付 ====================
export * from "./order.entity";
export * from "./subscription.entity";

// ==================== 分销与工单 ====================
export * from "./commission.entity";
export * from "./withdrawal.entity";

// ==================== 客服系统 ====================
export * from "./conversation.entity";
export * from "./message.entity";


// ==================== AI症状检查 ====================
export * from "./symptom-session.entity";

// ==================== 分析追踪 ====================
export * from "./user-activity.entity";

// ==================== 可穿戴设备集成 ====================
export * from "./wearable-connection.entity";
export * from "./wearable-health-data.entity";
