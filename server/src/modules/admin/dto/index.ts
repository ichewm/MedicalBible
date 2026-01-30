/**
 * @file DTO 导出
 * @description Admin 模块 DTO 统一导出
 * @author Medical Bible Team
 * @version 1.0.0
 */

export * from "./admin.dto";

// 命名导出
export {
  UserListQueryDto,
  UserListItemDto,
  UserListDto,
  UserDetailDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  DashboardStatsDto,
  StatsQueryDto,
  RevenueStatsItemDto,
  UserGrowthStatsItemDto,
  SystemConfigDto,
  UpdateSystemConfigDto,
  UpdateCaptchaConfigDto,
  UpdateEmailConfigDto,
  UpdateSmsConfigDto,
  UpdatePaymentConfigDto,
  UpdateAgreementDto,
  UpdateStorageConfigDto,
  UpdateTestEnvConfigDto,
  ClearTestDataDto,
  ClearTestDataResultDto,
} from "./admin.dto";
