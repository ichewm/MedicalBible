/**
 * @file 认证控制器
 * @description 处理认证相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";

import { AuthService } from "./auth.service";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuditLog } from "../../common/decorators/audit.decorator";
import { AuditAction } from "../../common/enums/sensitive-operations.enum";
import { JwtPayload } from "../../common/guards/jwt-auth.guard";
import { RateLimit, RateLimitPresets } from "../../common/guards/rate-limit.guard";
import {
  SendVerificationCodeDto,
  SendVerificationCodeResponseDto,
  LoginWithPhoneDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  RegisterDto,
  RegisterResponseDto,
  LoginWithPasswordDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from "./dto";

/**
 * 认证控制器
 * @description 提供登录、注册、验证码等接口
 */
@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 发送验证码
   * @param dto - 发送验证码请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.verificationCode)
  @Post("verification-code")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "发送验证码",
    description: "向指定手机号发送验证码，用于登录或注册",
  })
  @ApiResponse({
    status: 200,
    description: "验证码发送成功",
    type: SendVerificationCodeResponseDto,
  })
  @ApiResponse({ status: 400, description: "参数错误或发送频率过高" })
  async sendVerificationCode(
    @Body() dto: SendVerificationCodeDto,
  ): Promise<SendVerificationCodeResponseDto> {
    return this.authService.sendVerificationCode(dto);
  }

  /**
   * 手机号验证码登录
   * @param dto - 登录请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.login)
  @Post("login/phone")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "手机号登录",
    description: "使用手机号和验证码登录，新用户会自动注册",
  })
  @AuditLog({
    action: AuditAction.LOGIN_SUCCESS,
  })
  @ApiResponse({
    status: 200,
    description: "登录成功",
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: "验证码错误或已过期" })
  @ApiResponse({ status: 401, description: "账号已被禁用" })
  async loginWithPhone(
    @Body() dto: LoginWithPhoneDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.authService.loginWithPhone(dto, ipAddress);
  }

  /**
   * 注册新用户
   * @param dto - 注册请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.strict)
  @Post("register")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "注册新用户",
    description: "使用手机号、验证码和密码注册新用户",
  })
  @ApiResponse({
    status: 200,
    description: "注册成功",
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: "验证码错误或手机号已存在" })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * 重置密码
   * @param dto - 重置密码请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.strict)
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "重置密码",
    description: "使用手机号或邮箱验证码重置密码",
  })
  @ApiResponse({
    status: 200,
    description: "密码重置成功",
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: "验证码错误或用户不存在" })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(dto);
  }

  /**
   * 密码登录
   * @param dto - 登录请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.login)
  @Post("login/password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "密码登录",
    description: "使用手机号和密码登录",
  })
  @AuditLog({
    action: AuditAction.LOGIN_SUCCESS,
  })
  @ApiResponse({
    status: 200,
    description: "登录成功",
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: "密码错误或用户不存在" })
  @ApiResponse({ status: 401, description: "账号已被禁用" })
  async loginWithPassword(
    @Body() dto: LoginWithPasswordDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.getClientIp(req);
    return this.authService.loginWithPassword(dto, ipAddress);
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
      return ips.split(",")[0].trim();
    }
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
      return typeof realIp === "string" ? realIp : realIp[0];
    }
    return req.ip || req.socket?.remoteAddress || "";
  }

  /**
   * 获取系统公共配置
   */
  @Public()
  @Get("config")
  @ApiOperation({
    summary: "获取系统配置",
    description: "获取系统公共配置，如是否开放注册等",
  })
  async getSystemConfig() {
    return this.authService.getSystemConfig();
  }

  /**
   * 刷新 Token
   * @param dto - 刷新 Token 请求参数
   */
  @Public()
  @RateLimit(RateLimitPresets.standard)
  @Post("refresh-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "刷新 Token",
    description: "使用当前 Token 获取新的 Token（Token 即将过期时调用）",
  })
  @ApiResponse({
    status: 200,
    description: "刷新成功",
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: "Token 无效或已过期" })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  /**
   * 退出登录
   * @param user - 当前登录用户
   * @param authorization - Authorization 请求头
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "退出登录",
    description: "退出当前设备的登录状态，Token 将被加入黑名单",
  })
  @AuditLog({
    action: AuditAction.LOGOUT,
  })
  @ApiResponse({ status: 200, description: "退出成功" })
  @ApiResponse({ status: 401, description: "未登录" })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Headers("authorization") authorization: string,
  ): Promise<{ success: boolean; message: string }> {
    const token = authorization?.replace("Bearer ", "");
    return this.authService.logout(user.sub, user.deviceId, token);
  }

  /**
   * 已登录用户发送修改密码验证码
   * @param user - 当前登录用户
   * @param body - 请求参数（选择手机或邮箱）
   */
  @Post("send-change-password-code")
  @RateLimit(RateLimitPresets.verificationCode)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "发送修改密码验证码",
    description: "向当前登录用户的手机号或邮箱发送修改密码验证码",
  })
  @ApiResponse({
    status: 200,
    description: "验证码发送成功",
    type: SendVerificationCodeResponseDto,
  })
  @ApiResponse({ status: 400, description: "没有绑定手机号或邮箱" })
  @ApiResponse({ status: 401, description: "未登录" })
  async sendChangePasswordCode(
    @CurrentUser() user: JwtPayload,
    @Body() body: { method: "phone" | "email" },
  ): Promise<SendVerificationCodeResponseDto> {
    return this.authService.sendChangePasswordCode(user.sub, body.method);
  }

  /**
   * 已登录用户通过验证码修改密码
   * @param user - 当前登录用户
   * @param body - 请求参数
   */
  @Post("change-password-by-code")
  @RateLimit(RateLimitPresets.strict)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "验证码修改密码",
    description: "已登录用户通过验证码修改密码（使用用户真实手机号/邮箱验证）",
  })
  @AuditLog({
    action: AuditAction.PASSWORD_CHANGE,
  })
  @ApiResponse({
    status: 200,
    description: "密码修改成功",
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: "验证码错误或已过期" })
  @ApiResponse({ status: 401, description: "未登录" })
  async changePasswordByCode(
    @CurrentUser() user: JwtPayload,
    @Body() body: { method: "phone" | "email"; code: string; newPassword: string },
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.changePasswordByCode(user.sub, body.method, body.code, body.newPassword);
  }
}
