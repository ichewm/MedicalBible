/**
 * @file 用户控制器
 * @description 处理用户信息管理相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { UserService } from "./user.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../common/guards/jwt-auth.guard";
import {
  UpdateProfileDto,
  UserProfileDto,
  DeviceInfoDto,
  SetCurrentLevelDto,
  SetCurrentLevelResponseDto,
  SubscriptionInfoDto,
  BindPhoneDto,
  BindEmailDto,
  BindResponseDto,
} from "./dto";
import { Profession } from "../../entities/profession.entity";

/**
 * 用户控制器
 * @description 提供用户信息管理相关接口
 *
 * ## Authentication
 * All endpoints in this module require JWT authentication.
 * Include the token in the Authorization header:
 * \`Authorization: Bearer <your_jwt_token>\`
 *
 * ## User Profile
 * - Get and update user profile information
 * - Manage avatar and display name
 *
 * ## Device Management
 * - View all logged-in devices
 * - Remove specific devices (force logout)
 *
 * ## Subscription
 * - View active subscriptions
 * - Set current examination level
 *
 * ## Account Management
 * - Bind phone number or email
 * - Apply for account closure (7-day waiting period)
 */
@ApiTags("用户")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "user", version: "1" })
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户信息
   */
  @Get("profile")
  @ApiOperation({
    summary: "获取用户信息",
    description: `
获取当前登录用户的详细信息，包括个人资料、订阅状态、账户余额等。

**Authentication Required:**
\`\`\`http
GET /api/v1/user/profile
Authorization: Bearer <your_jwt_token>
\`\`\`

**Example Response:**
\`\`\`json
{
  "id": 1,
  "phone": "138****8000",
  "email": "u***e@example.com",
  "username": "用户12345",
  "avatarUrl": "https://cdn.medicalbible.com/avatar/user1.jpg",
  "inviteCode": "ABC12345",
  "balance": 100.50,
  "currentLevelId": 5,
  "level": {
    "id": 5,
    "name": "执业医师",
    "professionId": 1
  },
  "role": "user",
  "isNewUser": false,
  "subscribedLevels": [
    {
      "levelId": 5,
      "levelName": "执业医师",
      "expiresAt": "2024-12-31T23:59:59.000Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
\`\`\`
`,
  })
  @ApiResponse({ status: 200, description: "获取成功", type: UserProfileDto })
  @ApiResponse({ status: 401, description: "未登录" })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserProfileDto> {
    return this.userService.getProfile(user.sub);
  }

  /**
   * 更新用户信息
   */
  @Put("profile")
  @ApiOperation({
    summary: "更新用户信息",
    description: "更新当前用户的用户名、头像等信息",
  })
  @ApiResponse({ status: 200, description: "更新成功", type: UserProfileDto })
  @ApiResponse({ status: 400, description: "参数错误" })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.userService.updateProfile(user.sub, dto);
  }

  /**
   * 获取用户设备列表
   */
  @Get("devices")
  @ApiOperation({
    summary: "获取设备列表",
    description: "获取当前用户的所有登录设备",
  })
  @ApiResponse({ status: 200, description: "获取成功", type: [DeviceInfoDto] })
  async getDevices(@CurrentUser() user: JwtPayload): Promise<DeviceInfoDto[]> {
    return this.userService.getDevices(user.sub, user.deviceId);
  }

  /**
   * 移除设备（强制下线）
   */
  @Delete("devices/:deviceId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "移除设备",
    description: "移除指定设备，该设备将被强制下线",
  })
  @ApiResponse({ status: 200, description: "移除成功" })
  @ApiResponse({ status: 404, description: "设备不存在" })
  async removeDevice(
    @CurrentUser() user: JwtPayload,
    @Param("deviceId") deviceId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.removeDevice(user.sub, deviceId);
  }

  /**
   * 设置当前选中的等级
   */
  @Put("current-level")
  @ApiOperation({
    summary: "设置当前等级",
    description: "设置用户当前选中的考试等级（需要有对应的有效订阅）",
  })
  @ApiResponse({
    status: 200,
    description: "设置成功",
    type: SetCurrentLevelResponseDto,
  })
  @ApiResponse({ status: 400, description: "没有有效订阅" })
  async setCurrentLevel(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetCurrentLevelDto,
  ): Promise<SetCurrentLevelResponseDto> {
    return this.userService.setCurrentLevel(user.sub, dto.levelId);
  }

  /**
   * 获取用户订阅列表
   */
  @Get("subscriptions")
  @ApiOperation({
    summary: "获取订阅列表",
    description: "获取当前用户的所有订阅（默认只返回有效订阅）",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [SubscriptionInfoDto],
  })
  async getSubscriptions(
    @CurrentUser() user: JwtPayload,
    @Query("includeExpired") includeExpired?: boolean,
  ): Promise<SubscriptionInfoDto[]> {
    return this.userService.getSubscriptions(user.sub, includeExpired);
  }

  /**
   * 获取职业等级列表
   */
  @Get("profession-levels")
  @ApiOperation({
    summary: "获取职业等级列表",
    description: "获取所有职业大类及其包含的等级",
  })
  @ApiResponse({ status: 200, description: "获取成功", type: [Profession] })
  async getProfessionLevels(): Promise<Profession[]> {
    return this.userService.getProfessionLevels();
  }

  /**
   * 申请注销账号
   */
  @Post("close")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "申请注销账号",
    description: "申请注销账号，7天后账号将被永久删除",
  })
  @ApiResponse({ status: 200, description: "申请成功" })
  async applyForClose(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.applyForClose(user.sub);
  }

  /**
   * 取消注销申请
   */
  @Delete("close")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "取消注销申请",
    description: "取消注销账号的申请",
  })
  @ApiResponse({ status: 200, description: "取消成功" })
  async cancelClose(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    return this.userService.cancelClose(user.sub);
  }

  /**
   * 绑定手机号
   */
  @Post("bind-phone")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "绑定手机号",
    description: "为当前账号绑定手机号（需要验证码）",
  })
  @ApiResponse({ status: 200, description: "绑定成功", type: BindResponseDto })
  @ApiResponse({ status: 400, description: "验证码错误或手机号已被使用" })
  async bindPhone(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BindPhoneDto,
  ): Promise<BindResponseDto> {
    return this.userService.bindPhone(user.sub, dto);
  }

  /**
   * 绑定邮箱
   */
  @Post("bind-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "绑定邮箱",
    description: "为当前账号绑定邮箱（需要验证码）",
  })
  @ApiResponse({ status: 200, description: "绑定成功", type: BindResponseDto })
  @ApiResponse({ status: 400, description: "验证码错误或邮箱已被使用" })
  async bindEmail(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BindEmailDto,
  ): Promise<BindResponseDto> {
    return this.userService.bindEmail(user.sub, dto);
  }
}
