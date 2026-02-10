/**
 * @file 短信服务
 * @description 支持阿里云、腾讯云、容联云的短信发送服务
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CryptoService } from "../../common/crypto/crypto.service";
import { Retry } from "../../common/retry";
import {
  SystemConfig,
  SystemConfigKeys,
} from "../../entities/system-config.entity";
import * as https from "https";
import * as crypto from "crypto";

export interface SendSmsOptions {
  phone: string;
  code: string;
  templateParams?: Record<string, string>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

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
   * 发送验证码短信
   */
  async sendVerificationCode(
    phone: string,
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    const provider = await this.getConfig(SystemConfigKeys.SMS_PROVIDER);
    if (!provider) {
      return { success: false, error: "SMS provider not configured" };
    }

    switch (provider) {
      case "aliyun":
        return this.sendAliyunSms({ phone, code });
      case "tencent":
        return this.sendTencentSms({ phone, code });
      case "ronglian":
        return this.sendRonglianSms({ phone, code });
      default:
        return { success: false, error: `Unknown SMS provider: ${provider}` };
    }
  }

  /**
   * 阿里云短信发送
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async sendAliyunSms(
    options: SendSmsOptions,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accessKeyId = await this.getConfig(
        SystemConfigKeys.SMS_ALIYUN_ACCESS_KEY_ID,
      );
      const accessKeySecret = await this.getDecryptedConfig(
        SystemConfigKeys.SMS_ALIYUN_ACCESS_KEY_SECRET,
      );
      const signName = await this.getConfig(
        SystemConfigKeys.SMS_ALIYUN_SIGN_NAME,
      );
      const templateCode = await this.getConfig(
        SystemConfigKeys.SMS_ALIYUN_TEMPLATE_CODE,
      );

      if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
        return { success: false, error: "Aliyun SMS configuration incomplete" };
      }

      const params: Record<string, string> = {
        AccessKeyId: accessKeyId,
        Action: "SendSms",
        Format: "JSON",
        PhoneNumbers: options.phone,
        SignName: signName,
        SignatureMethod: "HMAC-SHA1",
        SignatureNonce: Math.random().toString(36).slice(2) + Date.now(),
        SignatureVersion: "1.0",
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify({ code: options.code }),
        Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        Version: "2017-05-25",
      };

      // 签名
      const sortedKeys = Object.keys(params).sort();
      const canonicalizedQuery = sortedKeys
        .map(
          (key) =>
            `${this.percentEncode(key)}=${this.percentEncode(params[key])}`,
        )
        .join("&");

      const stringToSign = `POST&${this.percentEncode("/")}&${this.percentEncode(canonicalizedQuery)}`;
      const signature = crypto
        .createHmac("sha1", accessKeySecret + "&")
        .update(stringToSign)
        .digest("base64");

      params.Signature = signature;

      // 发送请求
      const response = await this.httpPost(
        "dysmsapi.aliyuncs.com",
        "/",
        params,
      );
      const result = JSON.parse(response);

      if (result.Code === "OK") {
        this.logger.log(`Aliyun SMS sent successfully to ${options.phone}`);
        return { success: true };
      } else {
        this.logger.error(`Aliyun SMS failed: ${result.Message}`);
        return { success: false, error: result.Message };
      }
    } catch (error) {
      this.logger.error(`Aliyun SMS error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 腾讯云短信发送
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async sendTencentSms(
    options: SendSmsOptions,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const secretId = await this.getConfig(
        SystemConfigKeys.SMS_TENCENT_SECRET_ID,
      );
      const secretKey = await this.getDecryptedConfig(
        SystemConfigKeys.SMS_TENCENT_SECRET_KEY,
      );
      const appId = await this.getConfig(SystemConfigKeys.SMS_TENCENT_APP_ID);
      const signName = await this.getConfig(
        SystemConfigKeys.SMS_TENCENT_SIGN_NAME,
      );
      const templateId = await this.getConfig(
        SystemConfigKeys.SMS_TENCENT_TEMPLATE_ID,
      );

      if (!secretId || !secretKey || !appId || !signName || !templateId) {
        return {
          success: false,
          error: "Tencent SMS configuration incomplete",
        };
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

      const payload = JSON.stringify({
        PhoneNumberSet: [`+86${options.phone}`],
        SmsSdkAppId: appId,
        SignName: signName,
        TemplateId: templateId,
        TemplateParamSet: [options.code],
      });

      // 计算签名
      const service = "sms";
      const host = "sms.tencentcloudapi.com";
      const algorithm = "TC3-HMAC-SHA256";

      const hashedPayload = crypto
        .createHash("sha256")
        .update(payload)
        .digest("hex");
      const httpRequestMethod = "POST";
      const canonicalUri = "/";
      const canonicalQueryString = "";
      const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:sendstatus\n`;
      const signedHeaders = "content-type;host;x-tc-action";
      const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

      const credentialScope = `${date}/${service}/tc3_request`;
      const hashedCanonicalRequest = crypto
        .createHash("sha256")
        .update(canonicalRequest)
        .digest("hex");
      const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

      const secretDate = crypto
        .createHmac("sha256", `TC3${secretKey}`)
        .update(date)
        .digest();
      const secretService = crypto
        .createHmac("sha256", secretDate)
        .update(service)
        .digest();
      const secretSigning = crypto
        .createHmac("sha256", secretService)
        .update("tc3_request")
        .digest();
      const signature = crypto
        .createHmac("sha256", secretSigning)
        .update(stringToSign)
        .digest("hex");

      const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      // 发送请求
      const response = await this.httpPostRaw(host, "/", payload, {
        "Content-Type": "application/json",
        Host: host,
        "X-TC-Action": "SendSms",
        "X-TC-Version": "2021-01-11",
        "X-TC-Timestamp": timestamp.toString(),
        "X-TC-Region": "ap-guangzhou",
        Authorization: authorization,
      });

      const result = JSON.parse(response);
      if (
        result.Response &&
        result.Response.SendStatusSet?.[0]?.Code === "Ok"
      ) {
        this.logger.log(`Tencent SMS sent successfully to ${options.phone}`);
        return { success: true };
      } else {
        const errorMsg =
          result.Response?.Error?.Message ||
          result.Response?.SendStatusSet?.[0]?.Message ||
          "Unknown error";
        this.logger.error(`Tencent SMS failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      this.logger.error(`Tencent SMS error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 容联云短信发送
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async sendRonglianSms(
    options: SendSmsOptions,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accountSid = await this.getConfig(
        SystemConfigKeys.SMS_RONGLIAN_ACCOUNT_SID,
      );
      const authToken = await this.getDecryptedConfig(
        SystemConfigKeys.SMS_RONGLIAN_AUTH_TOKEN,
      );
      const appId = await this.getConfig(SystemConfigKeys.SMS_RONGLIAN_APP_ID);
      const templateId = await this.getConfig(
        SystemConfigKeys.SMS_RONGLIAN_TEMPLATE_ID,
      );

      if (!accountSid || !authToken || !appId || !templateId) {
        return {
          success: false,
          error: "Ronglian SMS configuration incomplete",
        };
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14);
      const sigParameter = crypto
        .createHash("md5")
        .update(`${accountSid}${authToken}${timestamp}`)
        .digest("hex")
        .toUpperCase();

      const authorization = Buffer.from(`${accountSid}:${timestamp}`).toString(
        "base64",
      );

      const url = `/2013-12-26/Accounts/${accountSid}/SMS/TemplateSMS?sig=${sigParameter}`;
      const body = JSON.stringify({
        to: options.phone,
        appId: appId,
        templateId: templateId,
        datas: [options.code, "5"],
      });

      const response = await this.httpPostRaw("app.cloopen.com", url, body, {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json",
        Authorization: authorization,
      });

      const result = JSON.parse(response);
      if (result.statusCode === "000000") {
        this.logger.log(`Ronglian SMS sent successfully to ${options.phone}`);
        return { success: true };
      } else {
        this.logger.error(`Ronglian SMS failed: ${result.statusMsg}`);
        return { success: false, error: result.statusMsg };
      }
    } catch (error) {
      this.logger.error(`Ronglian SMS error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * URL编码
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, "%20")
      .replace(/\*/g, "%2A")
      .replace(/%7E/g, "~");
  }

  /**
   * HTTP POST请求（表单格式）
   */
  private httpPost(
    host: string,
    path: string,
    params: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = Object.keys(params)
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
        )
        .join("&");

      const options = {
        hostname: host,
        port: 443,
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * HTTP POST请求（原始body）
   */
  private httpPostRaw(
    host: string,
    path: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: 443,
        path: path,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * 测试短信配置
   */
  async testSmsConfig(): Promise<{
    success: boolean;
    provider?: string;
    error?: string;
  }> {
    const provider = await this.getConfig(SystemConfigKeys.SMS_PROVIDER);
    if (!provider) {
      return { success: false, error: "SMS provider not configured" };
    }
    return { success: true, provider };
  }
}
