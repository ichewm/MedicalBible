/**
 * @file 验证码实体
 * @description 短信/邮箱验证码表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * 验证码类型枚举
 */
export enum VerificationCodeType {
  /** 注册 */
  REGISTER = 1,
  /** 登录 */
  LOGIN = 2,
  /** 修改密码 */
  CHANGE_PASSWORD = 3,
  /** 绑定手机号/邮箱 */
  BIND = 4,
}

/**
 * 验证码实体类
 * @description 存储短信/邮箱验证码，用于登录、注册等场景
 */
@Entity("verification_codes")
@Index("idx_verification_codes_phone_type", ["phone", "type"])
@Index("idx_verification_codes_email_type", ["email", "type"])
@Index("idx_verification_codes_expires_cleanup", ["expiresAt"])
export class VerificationCode {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ comment: "主键" })
  id: number;

  /** 手机号 */
  @Column({ type: "varchar", length: 20, nullable: true, comment: "手机号" })
  phone: string | null;

  /** 邮箱 */
  @Column({ type: "varchar", length: 100, nullable: true, comment: "邮箱" })
  email: string | null;

  /** 验证码 */
  @Column({ type: "varchar", length: 10, comment: "验证码" })
  code: string;

  /** 类型：1-注册，2-登录，3-修改密码 */
  @Column({ type: "tinyint", comment: "1:注册, 2:登录, 3:修改密码" })
  type: VerificationCodeType;

  /** 过期时间 */
  @Column({ name: "expires_at", type: "datetime", comment: "过期时间" })
  expiresAt: Date;

  /** 是否已使用：0-未使用，1-已使用 */
  @Column({ type: "tinyint", default: 0, comment: "0:未使用, 1:已使用" })
  used: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;
}
