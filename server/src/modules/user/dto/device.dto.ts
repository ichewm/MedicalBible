/**
 * @file 设备信息 DTO
 * @description 设备相关接口的 DTO
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

/**
 * 设备信息响应 DTO
 */
export class DeviceInfoDto {
  @ApiProperty({ description: "设备ID" })
  deviceId: string;

  @ApiProperty({ description: "设备名称" })
  deviceName: string;

  @ApiProperty({ description: "IP地址" })
  ipAddress: string;

  @ApiProperty({ description: "最后登录时间" })
  lastLoginAt: Date;

  @ApiProperty({ description: "是否为当前设备" })
  isCurrent: boolean;
}

/**
 * 移除设备请求 DTO
 */
export class RemoveDeviceDto {
  @ApiProperty({
    description: "设备ID",
    example: "device-uuid-12345",
  })
  @IsString({ message: "设备ID必须是字符串" })
  deviceId: string;
}
