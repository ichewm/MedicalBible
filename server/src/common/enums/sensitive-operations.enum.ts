/**
 * @file 敏感操作枚举
 * @description 定义审计日志中的操作类型和资源类型
 * @author Medical Bible Team
 * @version 1.0.0
 */

/**
 * 审计操作类型枚举
 * @description 定义所有需要审计记录的操作类型
 *
 * **用户管理操作** (user.*):
 * - USER_CREATE: 创建新用户
 * - USER_UPDATE: 更新用户信息
 * - USER_DELETE: 删除用户
 * - USER_STATUS_CHANGE: 修改用户状态（启用/禁用）
 * - USER_ROLE_CHANGE: 修改用户角色
 * - USER_PASSWORD_RESET: 重置用户密码
 *
 * **数据访问操作** (data.*):
 * - PII_ACCESS: 访问个人身份信息
 * - BULK_EXPORT: 批量导出数据
 * - ADMIN_QUERY: 管理员查询用户数据
 *
 * **数据修改操作** (data.*, content.*, config.*):
 * - DATA_UPDATE: 更新用户数据
 * - CONTENT_MODIFY: 修改内容（题目、讲义）
 * - CONFIG_CHANGE: 修改系统配置
 *
 * **数据删除操作** (data.*):
 * - DATA_DELETE: 删除数据
 * - TEST_DATA_CLEAR: 清空测试数据
 *
 * **认证操作** (auth.*):
 * - LOGIN_SUCCESS: 登录成功
 * - LOGIN_FAILED: 登录失败
 * - LOGOUT: 退出登录
 * - PASSWORD_CHANGE: 修改密码
 *
 * **权限管理操作** (role.*, permission.*):
 * - ROLE_CREATE: 创建角色
 * - ROLE_UPDATE: 更新角色
 * - ROLE_DELETE: 删除角色
 * - PERMISSION_ASSIGN: 分配权限
 */
export enum AuditAction {
  // ==================== 用户管理 ====================
  /** 创建用户 */
  USER_CREATE = "user.create",
  /** 更新用户信息 */
  USER_UPDATE = "user.update",
  /** 删除用户 */
  USER_DELETE = "user.delete",
  /** 修改用户状态 */
  USER_STATUS_CHANGE = "user.status_change",
  /** 修改用户角色 */
  USER_ROLE_CHANGE = "user.role_change",
  /** 重置用户密码 */
  USER_PASSWORD_RESET = "user.password_reset",

  // ==================== 数据访问 ====================
  /** 访问个人身份信息 */
  PII_ACCESS = "data.pii_access",
  /** 批量导出数据 */
  BULK_EXPORT = "data.bulk_export",
  /** 管理员查询用户数据 */
  ADMIN_QUERY = "data.admin_query",

  // ==================== 数据修改 ====================
  /** 更新用户数据 */
  DATA_UPDATE = "data.update",
  /** 修改内容（题目、讲义） */
  CONTENT_MODIFY = "content.modify",
  /** 修改系统配置 */
  CONFIG_CHANGE = "config.change",

  // ==================== 数据删除 ====================
  /** 删除数据 */
  DATA_DELETE = "data.delete",
  /** 清空测试数据 */
  TEST_DATA_CLEAR = "data.test_data_clear",

  // ==================== 认证操作 ====================
  /** 登录成功 */
  LOGIN_SUCCESS = "auth.login_success",
  /** 登录失败 */
  LOGIN_FAILED = "auth.login_failed",
  /** 退出登录 */
  LOGOUT = "auth.logout",
  /** 修改密码 */
  PASSWORD_CHANGE = "auth.password_change",

  // ==================== 权限管理 ====================
  /** 创建角色 */
  ROLE_CREATE = "role.create",
  /** 更新角色 */
  ROLE_UPDATE = "role.update",
  /** 删除角色 */
  ROLE_DELETE = "role.delete",
  /** 分配权限 */
  PERMISSION_ASSIGN = "permission.assign",
}

/**
 * 资源类型枚举
 * @description 定义审计日志中涉及的资源类型
 */
export enum ResourceType {
  /** 用户 */
  USER = "user",
  /** 题目 */
  QUESTION = "question",
  /** 讲义 */
  LECTURE = "lecture",
  /** 订单 */
  ORDER = "order",
  /** 订阅 */
  SUBSCRIPTION = "subscription",
  /** 系统配置 */
  SYSTEM_CONFIG = "system_config",
  /** 角色 */
  ROLE = "role",
  /** 权限 */
  PERMISSION = "permission",
  /** 试卷 */
  PAPER = "paper",
  /** 佣金 */
  COMMISSION = "commission",
  /** 提现 */
  WITHDRAWAL = "withdrawal",
  /** 会话 */
  CONVERSATION = "conversation",
  /** 消息 */
  MESSAGE = "message",
}
