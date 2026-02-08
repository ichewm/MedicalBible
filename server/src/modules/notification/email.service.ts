/**
 * @file 邮件服务
 * @description 支持多邮件服务商的邮件发送服务
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as nodemailer from "nodemailer";
import { CryptoService } from "../../common/crypto/crypto.service";
import {
  SystemConfig,
  SystemConfigKeys,
} from "../../entities/system-config.entity";

/**
 * 邮件服务商预设配置
 */
const EmailProviderPresets: Record<
  string,
  { host: string; port: number; secure: boolean }
> = {
  qq: {
    host: "smtp.qq.com",
    port: 465,
    secure: true,
  },
  "163": {
    host: "smtp.163.com",
    port: 465,
    secure: true,
  },
  enterprise: {
    host: "smtp.exmail.qq.com",
    port: 465,
    secure: true,
  },
  gmail: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
  },
  outlook: {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
  },
  custom: {
    host: "",
    port: 465,
    secure: true,
  },
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    private cryptoService: CryptoService,
  ) {}

  /**
   * 获取配置值
   */
  private async getConfig(key: string): Promise<string> {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key },
    });
    return config?.configValue || "";
  }

  /**
   * 获取解密后的配置值
   */
  private async getDecryptedConfig(key: string): Promise<string> {
    const value = await this.getConfig(key);
    if (!value) return "";
    try {
      if (this.cryptoService.isEncrypted(value)) {
        return this.cryptoService.decrypt(value);
      }
      return value;
    } catch {
      return value;
    }
  }

  /**
   * 初始化邮件传输器
   */
  private async initTransporter(): Promise<nodemailer.Transporter | null> {
    try {
      const provider = await this.getConfig(SystemConfigKeys.EMAIL_PROVIDER);
      if (!provider) {
        this.logger.warn("Email provider not configured");
        return null;
      }

      const preset =
        EmailProviderPresets[provider] || EmailProviderPresets.custom;
      const host =
        (await this.getConfig(SystemConfigKeys.EMAIL_SMTP_HOST)) || preset.host;
      const port =
        parseInt(await this.getConfig(SystemConfigKeys.EMAIL_SMTP_PORT)) ||
        preset.port;
      const user = await this.getConfig(SystemConfigKeys.EMAIL_SMTP_USER);
      const pass = await this.getDecryptedConfig(
        SystemConfigKeys.EMAIL_SMTP_PASS,
      );
      const useSSL =
        (await this.getConfig(SystemConfigKeys.EMAIL_USE_SSL)) !== "false";

      if (!host || !user || !pass) {
        this.logger.warn("Email configuration incomplete");
        return null;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: useSSL,
        auth: {
          user,
          pass,
        },
      });

      // 验证连接
      await transporter.verify();
      this.logger.log(
        `Email transporter initialized successfully (${provider})`,
      );
      return transporter;
    } catch (error) {
      this.logger.error(
        `Failed to initialize email transporter: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * 获取邮件传输器
   */
  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    // 每次发送都重新初始化，确保使用最新配置
    // 生产环境可考虑缓存+配置变更监听
    return this.initTransporter();
  }

  /**
   * 发送邮件
   */
  async sendEmail(
    options: SendEmailOptions,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        return { success: false, error: "Email service not configured" };
      }

      const fromName =
        (await this.getConfig(SystemConfigKeys.EMAIL_FROM_NAME)) || "医学宝典";
      const fromEmail = await this.getConfig(SystemConfigKeys.EMAIL_SMTP_USER);

      const result = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(
        `Email sent successfully to ${options.to}, messageId: ${result.messageId}`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      // Return generic error message to avoid exposing internal system details
      return { success: false, error: "Failed to send email. Please try again later." };
    }
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(
    to: string,
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let template = await this.getConfig(SystemConfigKeys.EMAIL_CODE_TEMPLATE);
      if (!template) {
        template = `
          <div style="padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px;">
              <h2 style="color: #1677ff; margin-bottom: 20px;">医学宝典 - 验证码</h2>
              <p>您好，</p>
              <p>您的验证码是：</p>
              <div style="font-size: 32px; font-weight: bold; color: #1677ff; letter-spacing: 5px; margin: 20px 0;">{{code}}</div>
              <p>验证码有效期为 <strong>5分钟</strong>，请勿泄露给他人。</p>
              <p style="color: #999; margin-top: 30px; font-size: 12px;">如果您没有请求此验证码，请忽略此邮件。</p>
            </div>
          </div>
        `;
      }

      const html = template.replace(/\{\{code\}\}/g, code);

      return this.sendEmail({
        to,
        subject: "【医学宝典】邮箱验证码",
        html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification code to ${to}: ${error.message}`,
      );
      // Return generic error message to avoid exposing internal system details
      return { success: false, error: "Failed to send verification code. Please try again later." };
    }
  }

  /**
   * 测试邮件配置
   */
  async testEmailConfig(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        return { success: false, error: "Email service not configured" };
      }
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to test email config: ${error.message}`);
      // Return generic error message to avoid exposing internal system details
      return { success: false, error: "Email configuration test failed." };
    }
  }
}
