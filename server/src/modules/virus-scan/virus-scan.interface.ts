/**
 * @file 病毒扫描接口定义
 * @description 定义病毒扫描器的抽象接口和配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

/**
 * 病毒扫描结果
 * @description 扫描操作的返回结果
 */
export interface ScanResult {
  /** 是否通过扫描（未检测到病毒） */
  isClean: boolean;
  /** 检测到的病毒名称（如果存在） */
  virusName?: string;
  /** 扫描器返回的原始消息 */
  message: string;
  /** 扫描耗时（毫秒） */
  scanDuration: number;
}

/**
 * 病毒扫描器配置
 * @description 扫描器的基础配置选项
 */
export interface VirusScanConfig {
  /** 扫描器类型 */
  provider: VirusScanProvider;
  /** 扫描超时时间（毫秒），默认 30000 (30秒) */
  timeout?: number;
  /** 最大可扫描文件大小（字节），默认 100MB */
  maxFileSize?: number;
  /** 当扫描器不可用时是否允许通过（fail-open 模式） */
  failOpen?: boolean;
}

/**
 * 病毒扫描提供商类型
 */
export enum VirusScanProvider {
  /** ClamAV 本地/远程扫描 */
  CLAMAV = "clamav",
  /** 云端扫描服务（占位） */
  CLOUD = "cloud",
  /** 禁用扫描（仅用于测试） */
  DISABLED = "disabled",
}

/**
 * ClamAV 特定配置
 */
export interface ClamAVConfig extends VirusScanConfig {
  provider: VirusScanProvider.CLAMAV;
  /** ClamAV 服务地址（TCP socket） */
  host?: string;
  /** ClamAV 服务端口，默认 3310 */
  port?: number;
  /** Unix socket 路径（如果使用本地 socket） */
  socketPath?: string;
}

/**
 * 病毒扫描器抽象接口
 * @description 所有扫描器实现必须遵循此接口
 */
export interface IVirusScanner {
  /**
   * 扫描文件缓冲区
   * @param buffer - 文件内容缓冲区
   * @param filename - 文件名（用于日志记录）
   * @returns 扫描结果
   * @throws VirusDetectedException 当检测到病毒时
   * @throws VirusScanException 当扫描失败时
   */
  scan(buffer: Buffer, filename?: string): Promise<ScanResult>;

  /**
   * 健康检查
   * @returns 扫描器是否可用
   */
  healthCheck(): Promise<boolean>;

  /**
   * 获取扫描器类型
   */
  getProvider(): VirusScanProvider;
}
