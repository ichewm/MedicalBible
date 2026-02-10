/**
 * @file 支付服务
 * @description 支持微信、支付宝、PayPal、Stripe的统一支付服务
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CryptoService } from "../../common/crypto/crypto.service";
import {
  SystemConfig,
  SystemConfigKeys,
} from "../../entities/system-config.entity";
import * as crypto from "crypto";
import * as https from "https";

export enum PaymentProvider {
  WECHAT = "wechat",
  ALIPAY = "alipay",
  PAYPAL = "paypal",
  STRIPE = "stripe",
}

export interface CreateOrderOptions {
  provider: PaymentProvider;
  orderNo: string;
  amount: number; // 单位：分
  subject: string;
  description?: string;
  returnUrl?: string;
  clientIp?: string;
}

export interface PaymentResult {
  success: boolean;
  payUrl?: string; // 支付链接
  qrCode?: string; // 二维码内容
  prepayId?: string; // 预支付ID
  error?: string;
  raw?: any;
}

export interface RefundOptions {
  provider: PaymentProvider;
  orderNo: string;
  refundNo: string;
  totalAmount: number;
  refundAmount: number;
  reason?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

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
   * 获取已启用的支付方式
   * 测试模式下，如果没有配置任何支付方式，默认支持所有
   */
  async getEnabledProviders(): Promise<PaymentProvider[]> {
    const providers: PaymentProvider[] = [];
    const isTestMode =
      (await this.getConfig(SystemConfigKeys.PAYMENT_TEST_MODE)) === "true";

    if (
      (await this.getConfig(SystemConfigKeys.PAY_WECHAT_ENABLED)) === "true"
    ) {
      providers.push(PaymentProvider.WECHAT);
    }
    if (
      (await this.getConfig(SystemConfigKeys.PAY_ALIPAY_ENABLED)) === "true"
    ) {
      providers.push(PaymentProvider.ALIPAY);
    }
    if (
      (await this.getConfig(SystemConfigKeys.PAY_PAYPAL_ENABLED)) === "true"
    ) {
      providers.push(PaymentProvider.PAYPAL);
    }
    if (
      (await this.getConfig(SystemConfigKeys.PAY_STRIPE_ENABLED)) === "true"
    ) {
      providers.push(PaymentProvider.STRIPE);
    }

    // 测试模式下，如果没有启用任何支付方式，默认支持所有支付方式
    if (isTestMode && providers.length === 0) {
      providers.push(
        PaymentProvider.ALIPAY,
        PaymentProvider.WECHAT,
        PaymentProvider.PAYPAL,
        PaymentProvider.STRIPE,
      );
    }

    return providers;
  }

  /**
   * 获取支付配置信息（公开API）
   */
  async getPaymentInfo(): Promise<{
    testMode: boolean;
    providers: PaymentProvider[];
  }> {
    const testMode =
      (await this.getConfig(SystemConfigKeys.PAYMENT_TEST_MODE)) === "true";
    const providers = await this.getEnabledProviders();
    return { testMode, providers };
  }

  /**
   * 创建支付订单
   */
  async createOrder(options: CreateOrderOptions): Promise<PaymentResult> {
    switch (options.provider) {
      case PaymentProvider.WECHAT:
        return this.createWechatOrder(options);
      case PaymentProvider.ALIPAY:
        return this.createAlipayOrder(options);
      case PaymentProvider.PAYPAL:
        return this.createPaypalOrder(options);
      case PaymentProvider.STRIPE:
        return this.createStripeOrder(options);
      default:
        return {
          success: false,
          error: `Unknown payment provider: ${options.provider}`,
        };
    }
  }

  /**
   * 微信支付 - Native支付（扫码支付）
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async createWechatOrder(
    options: CreateOrderOptions,
  ): Promise<PaymentResult> {
    try {
      const appId = await this.getConfig(SystemConfigKeys.PAY_WECHAT_APP_ID);
      const mchId = await this.getConfig(SystemConfigKeys.PAY_WECHAT_MCH_ID);
      const apiV3Key = await this.getDecryptedConfig(
        SystemConfigKeys.PAY_WECHAT_API_V3_KEY,
      );
      const privateKey = await this.getDecryptedConfig(
        SystemConfigKeys.PAY_WECHAT_PRIVATE_KEY,
      );
      const certSerial = await this.getConfig(
        SystemConfigKeys.PAY_WECHAT_CERT_SERIAL,
      );
      const notifyUrl = await this.getConfig(
        SystemConfigKeys.PAY_WECHAT_NOTIFY_URL,
      );

      if (
        !appId ||
        !mchId ||
        !apiV3Key ||
        !privateKey ||
        !certSerial ||
        !notifyUrl
      ) {
        return { success: false, error: "WeChat Pay configuration incomplete" };
      }

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = crypto.randomBytes(16).toString("hex");

      const body = JSON.stringify({
        appid: appId,
        mchid: mchId,
        description: options.subject,
        out_trade_no: options.orderNo,
        notify_url: notifyUrl,
        amount: {
          total: options.amount,
          currency: "CNY",
        },
      });

      // 签名
      const signMessage = `POST\n/v3/pay/transactions/native\n${timestamp}\n${nonceStr}\n${body}\n`;
      const sign = crypto
        .createSign("RSA-SHA256")
        .update(signMessage)
        .sign(privateKey, "base64");

      const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",signature="${sign}",timestamp="${timestamp}",serial_no="${certSerial}"`;

      const response = await this.httpsRequest({
        hostname: "api.mch.weixin.qq.com",
        path: "/v3/pay/transactions/native",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: authorization,
        },
        body,
      });

      const result = JSON.parse(response);
      if (result.code_url) {
        this.logger.log(`WeChat Pay order created: ${options.orderNo}`);
        return { success: true, qrCode: result.code_url };
      } else {
        return {
          success: false,
          error: result.message || "Unknown error",
          raw: result,
        };
      }
    } catch (error) {
      this.logger.error(`WeChat Pay error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 支付宝 - 当面付（扫码支付）
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async createAlipayOrder(
    options: CreateOrderOptions,
  ): Promise<PaymentResult> {
    try {
      const appId = await this.getConfig(SystemConfigKeys.PAY_ALIPAY_APP_ID);
      const privateKey = await this.getDecryptedConfig(
        SystemConfigKeys.PAY_ALIPAY_PRIVATE_KEY,
      );
      const gateway =
        (await this.getConfig(SystemConfigKeys.PAY_ALIPAY_GATEWAY)) ||
        "https://openapi.alipay.com/gateway.do";
      const notifyUrl = await this.getConfig(
        SystemConfigKeys.PAY_ALIPAY_NOTIFY_URL,
      );

      if (!appId || !privateKey) {
        return { success: false, error: "Alipay configuration incomplete" };
      }

      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      const bizContent = JSON.stringify({
        out_trade_no: options.orderNo,
        total_amount: (options.amount / 100).toFixed(2),
        subject: options.subject,
      });

      const params: Record<string, string> = {
        app_id: appId,
        method: "alipay.trade.precreate",
        format: "JSON",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp,
        version: "1.0",
        notify_url: notifyUrl,
        biz_content: bizContent,
      };

      // 签名
      const sortedKeys = Object.keys(params).sort();
      const signContent = sortedKeys
        .map((key) => `${key}=${params[key]}`)
        .join("&");
      const sign = crypto
        .createSign("RSA-SHA256")
        .update(signContent)
        .sign(privateKey, "base64");
      params.sign = sign;

      const queryString = Object.keys(params)
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
        )
        .join("&");

      const url = new URL(gateway);
      const response = await this.httpsRequest({
        hostname: url.hostname,
        path: `${url.pathname}?${queryString}`,
        method: "GET",
      });

      const result = JSON.parse(response);
      const resp = result.alipay_trade_precreate_response;

      if (resp?.code === "10000") {
        this.logger.log(`Alipay order created: ${options.orderNo}`);
        return { success: true, qrCode: resp.qr_code };
      } else {
        return {
          success: false,
          error: resp?.sub_msg || resp?.msg || "Unknown error",
          raw: result,
        };
      }
    } catch (error) {
      this.logger.error(`Alipay error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * PayPal - 创建订单
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async createPaypalOrder(
    options: CreateOrderOptions,
  ): Promise<PaymentResult> {
    try {
      const clientId = await this.getConfig(
        SystemConfigKeys.PAY_PAYPAL_CLIENT_ID,
      );
      const clientSecret = await this.getDecryptedConfig(
        SystemConfigKeys.PAY_PAYPAL_CLIENT_SECRET,
      );
      const mode =
        (await this.getConfig(SystemConfigKeys.PAY_PAYPAL_MODE)) || "sandbox";

      if (!clientId || !clientSecret) {
        return { success: false, error: "PayPal configuration incomplete" };
      }

      const baseUrl =
        mode === "live" ? "api.paypal.com" : "api.sandbox.paypal.com";

      // 获取access token
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      const tokenResponse = await this.httpsRequest({
        hostname: baseUrl,
        path: "/v1/oauth2/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: "grant_type=client_credentials",
      });

      const tokenResult = JSON.parse(tokenResponse);
      if (!tokenResult.access_token) {
        return { success: false, error: "Failed to get PayPal access token" };
      }

      // 创建订单
      const orderBody = JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: options.orderNo,
            amount: {
              currency_code: "USD",
              value: (options.amount / 100).toFixed(2),
            },
            description: options.subject,
          },
        ],
        application_context: {
          return_url: options.returnUrl || "https://example.com/success",
          cancel_url: options.returnUrl || "https://example.com/cancel",
        },
      });

      const orderResponse = await this.httpsRequest({
        hostname: baseUrl,
        path: "/v2/checkout/orders",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.access_token}`,
        },
        body: orderBody,
      });

      const orderResult = JSON.parse(orderResponse);
      if (orderResult.id) {
        const approveLink = orderResult.links?.find(
          (l: any) => l.rel === "approve",
        );
        this.logger.log(`PayPal order created: ${options.orderNo}`);
        return {
          success: true,
          payUrl: approveLink?.href,
          prepayId: orderResult.id,
        };
      } else {
        return {
          success: false,
          error: orderResult.message || "Unknown error",
          raw: orderResult,
        };
      }
    } catch (error) {
      this.logger.error(`PayPal error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stripe - 创建Checkout Session
   * @note Retry decorator removed - internal try/catch converts errors to { success: false }
   */
  private async createStripeOrder(
    options: CreateOrderOptions,
  ): Promise<PaymentResult> {
    try {
      const secretKey = await this.getDecryptedConfig(
        SystemConfigKeys.PAY_STRIPE_SECRET_KEY,
      );
      const mode =
        (await this.getConfig(SystemConfigKeys.PAY_STRIPE_MODE)) || "test";

      if (!secretKey) {
        return { success: false, error: "Stripe configuration incomplete" };
      }

      const body = new URLSearchParams({
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": options.subject,
        "line_items[0][price_data][unit_amount]": options.amount.toString(),
        "line_items[0][quantity]": "1",
        mode: "payment",
        success_url:
          options.returnUrl ||
          "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: options.returnUrl || "https://example.com/cancel",
        "metadata[order_no]": options.orderNo,
      });

      const response = await this.httpsRequest({
        hostname: "api.stripe.com",
        path: "/v1/checkout/sessions",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${secretKey}`,
        },
        body: body.toString(),
      });

      const result = JSON.parse(response);
      if (result.id) {
        this.logger.log(`Stripe session created: ${options.orderNo}`);
        return { success: true, payUrl: result.url, prepayId: result.id };
      } else {
        return {
          success: false,
          error: result.error?.message || "Unknown error",
          raw: result,
        };
      }
    } catch (error) {
      this.logger.error(`Stripe error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证微信支付回调签名
   * 微信V3使用平台证书验签
   */
  async verifyWechatCallback(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    serial: string,
  ): Promise<boolean> {
    try {
      // 获取微信支付平台证书（需要预先下载并配置）
      const platformCert = await this.getConfig(
        SystemConfigKeys.PAY_WECHAT_PLATFORM_CERT,
      );

      // 如果没有配置平台证书，拒绝验证（安全优先）
      if (!platformCert) {
        this.logger.error("WeChat platform cert not configured, rejecting callback");
        return false;
      }

      // 构造验签字符串
      const signMessage = `${timestamp}\n${nonce}\n${body}\n`;

      // 使用平台证书公钥验签
      const isValid = crypto
        .createVerify("RSA-SHA256")
        .update(signMessage)
        .verify(platformCert, signature, "base64");

      return isValid;
    } catch (error) {
      this.logger.error(`WeChat signature verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * 验证支付宝回调签名
   */
  async verifyAlipayCallback(params: Record<string, string>): Promise<boolean> {
    try {
      const publicKey = await this.getConfig(
        SystemConfigKeys.PAY_ALIPAY_PUBLIC_KEY,
      );
      if (!publicKey) return false;

      const { sign, sign_type, ...rest } = params;
      const sortedKeys = Object.keys(rest).sort();
      const signContent = sortedKeys
        .map((key) => `${key}=${rest[key]}`)
        .join("&");

      return crypto
        .createVerify("RSA-SHA256")
        .update(signContent)
        .verify(publicKey, sign, "base64");
    } catch {
      return false;
    }
  }

  /**
   * HTTPS请求
   */
  private httpsRequest(options: {
    hostname: string;
    path: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: options.hostname,
          port: 443,
          path: options.path,
          method: options.method,
          headers: options.headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        },
      );

      req.on("error", reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }
}
