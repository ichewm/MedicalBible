/**
 * @file 加密服务
 * @description 提供AES-256加密解密功能，用于敏感配置存储
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>("ENCRYPTION_KEY");
    if (!key) {
      this.logger.warn(
        "ENCRYPTION_KEY not set in environment, using default key (NOT SECURE FOR PRODUCTION!)",
      );
      // 开发环境默认密钥，生产环境必须配置
      this.encryptionKey = crypto.scryptSync(
        "medical-bible-default-key-dev-only",
        "salt",
        this.keyLength,
      );
    } else {
      // 使用环境变量中的密钥，通过scrypt派生确保长度正确
      this.encryptionKey = crypto.scryptSync(key, "salt", this.keyLength);
    }
  }

  /**
   * 加密文本
   * @param plaintext 明文
   * @returns 加密后的字符串 (格式: iv:authTag:ciphertext，均为hex编码)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return "";
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
        { authTagLength: this.authTagLength },
      );

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new InternalServerErrorException("加密失败");
    }
  }

  /**
   * 解密文本
   * @param encryptedText 加密文本 (格式: iv:authTag:ciphertext)
   * @returns 解密后的明文
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return "";
    }

    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new BadRequestException("无效的加密文本格式");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const ciphertext = parts[2];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
        { authTagLength: this.authTagLength },
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      // If it's already a BadRequestException from the format check, rethrow it
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new InternalServerErrorException("解密失败");
    }
  }

  /**
   * 检查文本是否已加密
   * @param text 待检查的文本
   * @returns 是否为加密格式
   */
  isEncrypted(text: string): boolean {
    if (!text) {
      return false;
    }
    const parts = text.split(":");
    if (parts.length !== 3) {
      return false;
    }
    // 检查iv和authTag的长度是否正确
    return (
      parts[0].length === this.ivLength * 2 &&
      parts[1].length === this.authTagLength * 2
    );
  }

  /**
   * 生成随机密钥（用于初始配置生成）
   * @returns 随机生成的密钥字符串
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * 哈希密码（单向）
   * @param password 密码
   * @param salt 盐值
   * @returns 哈希后的密码
   */
  hashPassword(
    password: string,
    salt?: string,
  ): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, actualSalt, 10000, 64, "sha512")
      .toString("hex");
    return { hash, salt: actualSalt };
  }

  /**
   * 验证密码
   * @param password 明文密码
   * @param hash 存储的哈希值
   * @param salt 盐值
   * @returns 是否匹配
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt);
    return hash === computedHash;
  }
}
