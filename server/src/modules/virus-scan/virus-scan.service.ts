/**
 * @file 病毒扫描服务
 * @description 提供文件病毒扫描功能，支持 ClamAV 和云端扫描
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IVirusScanner,
  ScanResult,
  VirusScanProvider,
  ClamAVConfig,
} from "./virus-scan.interface";
import { ClamAVScanner } from "./scanners/clamav.scanner";
import { DisabledScanner } from "./scanners/disabled.scanner";
import {
  VirusDetectedException,
  VirusScanException,
} from "@common/exceptions/business.exception";

/**
 * 病毒扫描服务
 * @description 统一的病毒扫描服务入口，支持多种扫描器后端
 */
@Injectable()
export class VirusScanService implements IVirusScanner {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly scanner: IVirusScanner;
  private readonly enabled: boolean;
  private readonly failOpen: boolean;

  constructor(private readonly configService: ConfigService) {
    // 从配置读取扫描器类型
    const provider = (this.configService.get<string>("upload.virusScanProvider") ||
      VirusScanProvider.CLAMAV) as VirusScanProvider;

    this.enabled = this.configService.get<string>("upload.virusScanEnabled") === "true";
    this.failOpen =
      this.configService.get<string>("upload.virusScanFailOpen") !== "false";

    // 根据配置创建扫描器实例
    this.scanner = this.createScanner(provider);

    this.logger.log(
      `Virus scan service initialized: provider=${provider}, enabled=${this.enabled}, failOpen=${this.failOpen}`,
    );
  }

  /**
   * 扫描文件缓冲区
   * @param buffer - 文件内容缓冲区
   * @param filename - 文件名（用于日志记录）
   * @returns 扫描结果
   * @throws VirusDetectedException 当检测到病毒时
   * @throws VirusScanException 当扫描失败且未启用 fail-open 时
   */
  async scan(buffer: Buffer, filename?: string): Promise<ScanResult> {
    // 如果未启用病毒扫描，直接返回干净结果
    if (!this.enabled) {
      this.logger.debug("Virus scanning is disabled, skipping scan");
      return {
        isClean: true,
        message: "Virus scanning is disabled",
        scanDuration: 0,
      };
    }

    const startTime = Date.now();
    const displayName = filename || "unknown";

    try {
      this.logger.debug(`Starting virus scan for file: ${displayName} (${buffer.length} bytes)`);

      const result = await this.executeScan(buffer, filename);

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Virus scan completed for ${displayName}: clean=${result.isClean}, duration=${duration}ms`,
      );

      return {
        ...result,
        scanDuration: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // 如果是病毒检测异常，直接抛出
      if (error instanceof VirusDetectedException) {
        throw error;
      }

      // 其他错误根据 fail-open 配置决定是否抛出
      if (this.failOpen) {
        this.logger.warn(
          `Virus scan failed for ${displayName}, allowing due to fail-open mode: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          isClean: true,
          message: `Scan failed, allowed by fail-open: ${error instanceof Error ? error.message : String(error)}`,
          scanDuration: duration,
        };
      }

      this.logger.error(
        `Virus scan failed for ${displayName}: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new VirusScanException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 执行实际的扫描操作
   * @private
   */
  private async executeScan(buffer: Buffer, filename?: string): Promise<ScanResult> {
    const result = await this.scanner.scan(buffer, filename);

    // 如果检测到病毒，抛出异常
    if (!result.isClean) {
      throw new VirusDetectedException(
        filename || "unknown",
        result.virusName || "Unknown virus",
      );
    }

    return result;
  }

  /**
   * 健康检查
   * @returns 扫描器是否可用
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      return await this.scanner.healthCheck();
    } catch (error) {
      this.logger.error("Virus scanner health check failed:", error);
      return this.failOpen; // fail-open 模式下认为服务仍可用
    }
  }

  /**
   * 获取扫描器类型
   */
  getProvider(): VirusScanProvider {
    return this.scanner.getProvider();
  }

  /**
   * 创建扫描器实例
   * @private
   */
  private createScanner(provider: VirusScanProvider): IVirusScanner {
    switch (provider) {
      case VirusScanProvider.CLAMAV: {
        const config: ClamAVConfig = {
          provider: VirusScanProvider.CLAMAV,
          host: this.configService.get<string>("upload.virusScanClamavHost") || "localhost",
          port: parseInt(
            this.configService.get<string>("upload.virusScanClamavPort") || "3310",
            10,
          ),
          socketPath: this.configService.get<string>("upload.virusScanClamavSocket"),
          timeout: parseInt(
            this.configService.get<string>("upload.virusScanTimeout") || "30000",
            10,
          ),
          maxFileSize: parseInt(
            this.configService.get<string>("upload.virusScanMaxFileSize") ||
              String(100 * 1024 * 1024),
            10,
          ),
          failOpen: this.failOpen,
        };
        return new ClamAVScanner(config, this.logger);
      }

      case VirusScanProvider.DISABLED:
        return new DisabledScanner();

      default:
        this.logger.warn(`Unknown virus scan provider: ${provider}, using disabled scanner`);
        return new DisabledScanner();
    }
  }
}
