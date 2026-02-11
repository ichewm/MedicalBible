/**
 * @file 可穿戴设备健康数据实体
 * @description 存储来自 Apple HealthKit 和 Android Health Connect 的健康数据
 * @author Medical Bible Team
 * @version 1.0.0
 * @see doc/wearable-integration-research.md
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { HealthDataSource } from "./wearable-connection.entity";

// Re-export HealthDataSource for convenience (allows importing from this file)
export { HealthDataSource };

/**
 * 健康数据类型枚举
 * 对应 HealthKit 和 Health Connect 的数据类型
 */
export enum HealthDataType {
  /** 步数 */
  STEPS = "steps",
  /** 心率 */
  HEART_RATE = "heart_rate",
  /** 睡眠 */
  SLEEP = "sleep",
  /** 活跃卡路里 */
  ACTIVE_CALORIES = "active_calories",
  /** 距离 */
  DISTANCE = "distance",
  /** 血压 */
  BLOOD_PRESSURE = "blood_pressure",
  /** 体重 */
  WEIGHT = "weight",
  /** 血氧 */
  BLOOD_OXYGEN = "blood_oxygen",
  /** 体温 */
  BODY_TEMPERATURE = "body_temperature",
}

/**
 * 可穿戴设备健康数据实体
 * @description 存储来自各种可穿戴设备的标准化健康数据
 */
@Entity("wearable_health_data")
@Index("idx_wearable_health_user_type_time", ["userId", "dataType", "recordedAt"])
@Index("idx_wearable_health_user_source", ["userId", "dataSource"])
export class WearableHealthData {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 数据来源平台 */
  @Column({
    name: "data_source",
    type: "enum",
    enum: HealthDataSource,
    comment: "数据来源：healthkit, health_connect, third_party",
  })
  dataSource: HealthDataSource;

  /** 设备标识（如 Apple Watch 型号、Fitbit 型号等） */
  @Column({
    name: "device_identifier",
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "设备标识",
  })
  deviceIdentifier: string | null;

  /** 健康数据类型 */
  @Column({
    name: "data_type",
    type: "enum",
    enum: HealthDataType,
    comment: "数据类型：steps, heart_rate, sleep, etc.",
  })
  dataType: HealthDataType;

  /** 数值（适用于步数、心率、卡路里等） */
  @Column({
    type: "decimal",
    precision: 12,
    scale: 4,
    nullable: true,
    comment: "数值（适用于步数、心率、卡路里等）",
  })
  value: number | null;

  /** 单位（如 steps, bpm, kcal, meters, mmHg, kg, %, ℃） */
  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "单位（steps, bpm, kcal, meters, mmHg, kg, %, ℃）",
  })
  unit: string | null;

  /** JSON 数据（适用于复杂数据如睡眠分析、血压等） */
  @Column({
    type: "json",
    nullable: true,
    comment: "JSON 数据（适用于复杂数据）",
  })
  metadata: Record<string, unknown> | null;

  /** 数据记录时间（设备上的时间戳） */
  @Column({
    name: "recorded_at",
    type: "datetime",
    comment: "数据记录时间（设备上的时间戳）",
  })
  recordedAt: Date;

  /** 数据起始时间（适用于时间段数据，如睡眠、运动） */
  @Column({
    name: "start_time",
    type: "datetime",
    nullable: true,
    comment: "数据起始时间（适用于时间段数据）",
  })
  startTime: Date | null;

  /** 数据结束时间（适用于时间段数据，如睡眠、运动） */
  @Column({
    name: "end_time",
    type: "datetime",
    nullable: true,
    comment: "数据结束时间（适用于时间段数据）",
  })
  endTime: Date | null;

  /** 创建时间（服务器接收到数据的时间） */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
