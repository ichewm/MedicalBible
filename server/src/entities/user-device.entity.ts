/**
 * @file 用户设备实体
 * @description 用户登录设备管理表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * 用户设备实体类
 * @description 管理用户登录设备，实现多设备登录限制
 */
@Entity("user_devices")
@Index("idx_user_devices_user_device", ["userId", "deviceId"], { unique: true })
export class UserDevice {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 设备唯一标识 */
  @Column({
    name: "device_id",
    type: "varchar",
    length: 100,
    comment: "设备唯一标识",
  })
  deviceId: string;

  /** 设备名称 */
  @Column({
    name: "device_name",
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "设备名称（如 iPhone 13）",
  })
  deviceName: string;

  /** 最后登录 IP */
  @Column({
    name: "ip_address",
    type: "varchar",
    length: 45,
    nullable: true,
    comment: "最后登录 IP",
  })
  ipAddress: string;

  /** 最后登录时间 */
  @Column({ name: "last_login_at", type: "datetime", comment: "最后登录时间" })
  lastLoginAt: Date;

  /** 当前有效 Token 签名 */
  @Column({
    name: "token_signature",
    type: "varchar",
    length: 255,
    comment: "当前有效 Token 签名",
    nullable: true,
  })
  tokenSignature: string | null;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.devices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
