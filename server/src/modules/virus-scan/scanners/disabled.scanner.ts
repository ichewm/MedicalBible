/**
 * @file 禁用状态的扫描器
 * @description 当病毒扫描功能被禁用时使用的无操作扫描器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IVirusScanner,
  ScanResult,
  VirusScanProvider,
} from "../virus-scan.interface";

/**
 * 禁用状态的扫描器
 * @description 始终返回扫描通过，用于测试或禁用病毒扫描的场景
 */
export class DisabledScanner implements IVirusScanner {
  /**
   * 扫描文件缓冲区（无操作，始终返回干净）
   */
  async scan(_buffer: Buffer, filename?: string): Promise<ScanResult> {
    return {
      isClean: true,
      message: filename
        ? `Virus scanning is disabled, skipped scan for ${filename}`
        : "Virus scanning is disabled",
      scanDuration: 0,
    };
  }

  /**
   * 健康检查（始终返回 true）
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  /**
   * 获取扫描器类型
   */
  getProvider(): VirusScanProvider {
    return VirusScanProvider.DISABLED;
  }
}
