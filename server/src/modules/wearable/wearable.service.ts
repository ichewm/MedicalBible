/**
 * @file 可穿戴设备服务
 * @description 处理可穿戴设备连接和健康数据业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";

import {
  WearableConnection,
  ConnectionStatus,
  HealthDataSource,
} from "../../entities/wearable-connection.entity";
import {
  WearableHealthData,
  HealthDataType,
} from "../../entities/wearable-health-data.entity";
import {
  CreateWearableConnectionDto,
  UpdateConnectionStatusDto,
  UploadHealthDataDto,
  QueryHealthDataDto,
  WearableConnectionDto,
  HealthDataResponseDto,
  UploadHealthDataResponseDto,
  HealthDataSummaryDto,
  SyncStatusDto,
} from "./dto";

/**
 * 可穿戴设备服务
 * @description 提供可穿戴设备连接管理和健康数据处理功能
 */
@Injectable()
export class WearableService {
  private readonly logger = new Logger(WearableService.name);

  constructor(
    @InjectRepository(WearableConnection)
    private readonly connectionRepository: Repository<WearableConnection>,
    @InjectRepository(WearableHealthData)
    private readonly healthDataRepository: Repository<WearableHealthData>,
  ) {}

  /**
   * 获取用户的所有可穿戴设备连接
   */
  async getConnections(userId: number): Promise<WearableConnectionDto[]> {
    const connections = await this.connectionRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    return connections.map(this.mapConnectionToDto);
  }

  /**
   * 创建可穿戴设备连接
   */
  async createConnection(
    userId: number,
    dto: CreateWearableConnectionDto,
  ): Promise<WearableConnectionDto> {
    // 检查是否已存在相同数据源的连接
    const existingConnection = await this.connectionRepository.findOne({
      where: { userId, dataSource: dto.dataSource },
    });

    if (existingConnection) {
      throw new BadRequestException(
        `已存在 ${dto.dataSource} 数据源的连接，请先删除现有连接`,
      );
    }

    const connection = this.connectionRepository.create({
      userId,
      dataSource: dto.dataSource,
      status: ConnectionStatus.ACTIVE,
      deviceInfo: dto.deviceInfo,
      authorizedDataTypes: dto.authorizedDataTypes || [],
      lastSyncAt: new Date(),
    });

    const savedConnection = await this.connectionRepository.save(connection);

    this.logger.log(
      `用户 ${userId} 创建了 ${dto.dataSource} 连接`,
    );

    return this.mapConnectionToDto(savedConnection);
  }

  /**
   * 更新连接状态
   */
  async updateConnectionStatus(
    userId: number,
    connectionId: number,
    dto: UpdateConnectionStatusDto,
  ): Promise<WearableConnectionDto> {
    const connection = await this.getConnectionForUser(userId, connectionId);

    connection.status = dto.status;

    if (dto.status === ConnectionStatus.ERROR) {
      connection.errorMessage = dto.errorMessage || "同步失败";
      connection.errorCount += 1;
    } else if (dto.status === ConnectionStatus.ACTIVE) {
      connection.errorMessage = null;
      connection.errorCount = 0;
    }

    const updatedConnection = await this.connectionRepository.save(connection);

    this.logger.log(
      `用户 ${userId} 更新了连接 ${connectionId} 的状态为 ${dto.status}`,
    );

    return this.mapConnectionToDto(updatedConnection);
  }

  /**
   * 删除可穿戴设备连接
   */
  async deleteConnection(
    userId: number,
    connectionId: number,
  ): Promise<{ success: boolean; message: string }> {
    const connection = await this.getConnectionForUser(userId, connectionId);

    await this.connectionRepository.remove(connection);

    // 同时删除该连接相关的健康数据（可选，根据业务需求）
    await this.healthDataRepository.delete({
      userId,
      dataSource: connection.dataSource,
    });

    this.logger.log(
      `用户 ${userId} 删除了 ${connection.dataSource} 连接`,
    );

    return {
      success: true,
      message: "连接已删除",
    };
  }

  /**
   * 上传健康数据
   */
  async uploadHealthData(
    userId: number,
    dto: UploadHealthDataDto,
  ): Promise<UploadHealthDataResponseDto> {
    // 查找或创建连接
    let connection = await this.connectionRepository.findOne({
      where: { userId, dataSource: dto.dataSource },
    });

    if (!connection) {
      // 自动创建连接（如果不存在）
      connection = this.connectionRepository.create({
        userId,
        dataSource: dto.dataSource,
        status: ConnectionStatus.ACTIVE,
        deviceInfo: dto.deviceIdentifier ? { deviceIdentifier: dto.deviceIdentifier } : null,
        lastSyncAt: new Date(),
      });
      connection = await this.connectionRepository.save(connection);
    }

    const errors: Array<{ index: number; message: string }> = [];
    let successCount = 0;

    // 批量插入健康数据
    for (let i = 0; i < dto.healthData.length; i++) {
      const item = dto.healthData[i];

      try {
        const healthData = this.healthDataRepository.create({
          userId,
          dataSource: dto.dataSource,
          deviceIdentifier: dto.deviceIdentifier,
          dataType: item.dataType,
          value: item.value ?? null,
          unit: item.unit ?? null,
          metadata: item.metadata ?? null,
          recordedAt: new Date(item.recordedAt),
          startTime: item.startTime ? new Date(item.startTime) : null,
          endTime: item.endTime ? new Date(item.endTime) : null,
        });

        await this.healthDataRepository.save(healthData);
        successCount++;
      } catch (error) {
        this.logger.error(
          `保存健康数据失败 (用户: ${userId}, 索引: ${i}): ${error.message}`,
        );
        errors.push({ index: i, message: error.message });
      }
    }

    // 更新连接的同步状态
    connection.lastSyncAt = new Date();
    if (dto.healthData.length > 0) {
      const latestRecordedAt = dto.healthData
        .map((d) => new Date(d.recordedAt))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      connection.lastDataTimestamp = latestRecordedAt;
    }

    if (errors.length > 0 && errors.length === dto.healthData.length) {
      // 全部失败
      connection.status = ConnectionStatus.ERROR;
      connection.errorMessage = "所有数据上传失败";
      connection.errorCount += 1;
    } else {
      connection.status = ConnectionStatus.ACTIVE;
      connection.errorMessage = null;
      connection.errorCount = 0;
    }

    await this.connectionRepository.save(connection);

    this.logger.log(
      `用户 ${userId} 上传了 ${successCount}/${dto.healthData.length} 条健康数据 (${dto.dataSource})`,
    );

    return {
      successCount,
      failedCount: errors.length,
      connectionId: connection.id,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 获取健康数据
   */
  async getHealthData(
    userId: number,
    query: QueryHealthDataDto,
  ): Promise<HealthDataResponseDto[]> {
    const { dataType, dataSource, startDate, endDate, offset = 0, limit = 50 } = query;

    const whereConditions: any = { userId };

    if (dataType) {
      whereConditions.dataType = dataType;
    }

    if (dataSource) {
      whereConditions.dataSource = dataSource;
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      // 设置结束时间为当天的 23:59:59
      end.setHours(23, 59, 59, 999);
      whereConditions.recordedAt = Between(start, end);
    }

    const healthData = await this.healthDataRepository.find({
      where: whereConditions,
      order: { recordedAt: "DESC" },
      skip: offset,
      take: Math.min(limit, 100), // 限制最大 100 条
    });

    return healthData.map(this.mapHealthDataToDto);
  }

  /**
   * 获取健康数据汇总
   */
  async getHealthDataSummary(
    userId: number,
    dataType: string,
    startDate?: string,
    endDate?: string,
  ): Promise<HealthDataSummaryDto[]> {
    const validDataType = this.validateDataType(dataType);

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 获取指定时间范围内的数据
    const healthData = await this.healthDataRepository.find({
      where: {
        userId,
        dataType: validDataType,
        recordedAt: Between(start, end),
      },
      order: { recordedAt: "ASC" },
    });

    // 按日期分组汇总
    const dailySummary = new Map<string, HealthDataSummaryDto>();

    for (const data of healthData) {
      const dateKey = data.recordedAt.toISOString().split("T")[0];

      if (!dailySummary.has(dateKey)) {
        dailySummary.set(dateKey, {
          dataType: data.dataType,
          summaryValue: 0,
          unit: data.unit || "",
          count: 0,
          min: data.value ?? Number.MAX_VALUE,
          max: data.value ?? Number.MIN_VALUE,
          date: dateKey,
        });
      }

      const summary = dailySummary.get(dateKey)!;
      summary.count += 1;

      if (data.value !== null) {
        summary.summaryValue += data.value;
        if (data.value < (summary.min ?? Number.MAX_VALUE)) {
          summary.min = data.value;
        }
        if (data.value > (summary.max ?? Number.MIN_VALUE)) {
          summary.max = data.value;
        }
      }
    }

    // 计算平均值（对于步数等累计数据，这里返回总和；对于心率等瞬时数据，可改为平均值）
    const result = Array.from(dailySummary.values()).map((summary) => {
      // 根据数据类型决定使用总和还是平均值
      if (
        [HealthDataType.STEPS, HealthDataType.ACTIVE_CALORIES, HealthDataType.DISTANCE].includes(
          summary.dataType as HealthDataType,
        )
      ) {
        // 累计数据，保持总和
      } else {
        // 瞬时数据，计算平均值
        if (summary.count > 0) {
          summary.summaryValue = Number((summary.summaryValue / summary.count).toFixed(2));
        }
      }

      // 清理 min/max
      if (summary.min === Number.MAX_VALUE) {
        summary.min = undefined;
      }
      if (summary.max === Number.MIN_VALUE) {
        summary.max = undefined;
      }

      return summary;
    });

    return result;
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(
    userId: number,
    connectionId: number,
  ): Promise<SyncStatusDto> {
    const connection = await this.getConnectionForUser(userId, connectionId);

    return {
      connectionId: connection.id,
      syncStatus: connection.status === ConnectionStatus.ERROR ? "failed" : "success",
      syncedAt: connection.lastSyncAt ?? connection.createdAt,
    };
  }

  /**
   * 删除单条健康数据
   */
  async deleteHealthData(
    userId: number,
    dataId: number,
  ): Promise<{ success: boolean; message: string }> {
    const healthData = await this.healthDataRepository.findOne({
      where: { id: dataId, userId },
    });

    if (!healthData) {
      throw new NotFoundException("健康数据不存在");
    }

    await this.healthDataRepository.remove(healthData);

    this.logger.log(`用户 ${userId} 删除了健康数据 ${dataId}`);

    return {
      success: true,
      message: "健康数据已删除",
    };
  }

  /**
   * 删除用户的所有健康数据（符合隐私法规要求）
   */
  async deleteAllHealthData(
    userId: number,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    const result = await this.healthDataRepository.delete({ userId });

    this.logger.log(`用户 ${userId} 删除了所有健康数据 (${result.affected} 条)`);

    return {
      success: true,
      message: "所有健康数据已删除",
      deletedCount: result.affected || 0,
    };
  }

  /**
   * 私有方法：获取用户连接（带权限检查）
   */
  private async getConnectionForUser(
    userId: number,
    connectionId: number,
  ): Promise<WearableConnection> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException("连接不存在");
    }

    return connection;
  }

  /**
   * 私有方法：验证数据类型
   */
  private validateDataType(dataType: string): HealthDataType {
    if (!Object.values(HealthDataType).includes(dataType as HealthDataType)) {
      throw new BadRequestException(`无效的数据类型: ${dataType}`);
    }
    return dataType as HealthDataType;
  }

  /**
   * 私有方法：映射连接实体到 DTO
   */
  private mapConnectionToDto(connection: WearableConnection): WearableConnectionDto {
    return {
      id: connection.id,
      dataSource: connection.dataSource,
      status: connection.status,
      deviceInfo: connection.deviceInfo as Record<string, unknown> | undefined,
      authorizedDataTypes: connection.authorizedDataTypes,
      lastSyncAt: connection.lastSyncAt ?? undefined,
      errorMessage: connection.errorMessage ?? undefined,
      errorCount: connection.errorCount,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }

  /**
   * 私有方法：映射健康数据实体到 DTO
   */
  private mapHealthDataToDto(data: WearableHealthData): HealthDataResponseDto {
    return {
      id: data.id,
      dataSource: data.dataSource,
      deviceIdentifier: data.deviceIdentifier ?? undefined,
      dataType: data.dataType,
      value: data.value ?? undefined,
      unit: data.unit ?? undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      recordedAt: data.recordedAt,
      startTime: data.startTime ?? undefined,
      endTime: data.endTime ?? undefined,
      createdAt: data.createdAt,
    };
  }
}
