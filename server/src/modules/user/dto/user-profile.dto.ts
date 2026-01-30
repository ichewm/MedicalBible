/**
 * @file 用户信息响应 DTO
 * @description 用户信息接口的响应格式
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 订阅信息 DTO
 */
export class SubscriptionInfoDto {
  @ApiProperty({ description: "订阅ID" })
  id: number;

  @ApiProperty({ description: "等级ID" })
  levelId: number;

  @ApiProperty({ description: "等级名称" })
  levelName: string;

  @ApiProperty({ description: "职业名称" })
  professionName: string;

  @ApiProperty({ description: "生效时间" })
  startAt: Date;

  @ApiProperty({ description: "过期时间" })
  expireAt: Date;

  @ApiProperty({ description: "是否有效" })
  isActive: boolean;
}

/**
 * 用户信息响应 DTO
 */
export class UserProfileDto {
  @ApiProperty({ description: "用户ID" })
  id: number;

  @ApiProperty({ description: "手机号（脱敏）", example: "138****8000" })
  phone: string;

  @ApiPropertyOptional({ description: "邮箱", example: "user@example.com" })
  email?: string;

  @ApiProperty({ description: "用户名" })
  username: string;

  @ApiPropertyOptional({ description: "头像URL" })
  avatarUrl?: string;

  @ApiProperty({ description: "邀请码" })
  inviteCode: string;

  @ApiProperty({ description: "账户余额" })
  balance: number;

  @ApiPropertyOptional({ description: "当前选中的等级ID" })
  currentLevelId?: number;

  @ApiPropertyOptional({ description: "当前选中的等级名称" })
  currentLevelName?: string;

  @ApiProperty({ description: "用户状态", example: 1, enum: [0, 1, 2] })
  status: number;

  @ApiPropertyOptional({ description: "注销申请时间" })
  closedAt?: Date;

  @ApiProperty({ description: "订阅列表", type: [SubscriptionInfoDto] })
  subscriptions: SubscriptionInfoDto[];

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}
