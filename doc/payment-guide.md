# 支付接入指南

本文档详细介绍医学宝典系统支持的各种支付方式的接入流程、申请指南和配置说明。

## 目录

1. [支付方式对比](#支付方式对比)
2. [微信支付](#微信支付)
3. [支付宝支付](#支付宝支付)
4. [PayPal](#paypal)
5. [Stripe](#stripe)
6. [推荐方案](#推荐方案)

---

## 支付方式对比

| 支付方式 | 申请难度 | 适用场景 | 手续费 | 到账时间 | 支持货币 |
|---------|---------|---------|--------|---------|---------|
| 微信支付 | ⭐⭐⭐⭐ | 国内用户 | 0.6% | T+1 | CNY |
| 支付宝 | ⭐⭐⭐⭐ | 国内用户 | 0.6% | T+1 | CNY |
| PayPal | ⭐⭐ | 国际用户 | 2.9%+0.3$ | 即时 | 多币种 |
| Stripe | ⭐⭐ | 国际用户 | 2.9%+0.3$ | 2天 | 多币种 |

### 申请难度说明
- ⭐ - 个人即可申请，流程简单
- ⭐⭐ - 个人可申请，需要身份验证
- ⭐⭐⭐ - 需要企业资质
- ⭐⭐⭐⭐ - 需要企业资质+已备案网站/APP

---

## 微信支付

### 申请条件
1. **企业资质**：需要营业执照
2. **已备案网站/APP**：需要ICP备案号
3. **对公银行账户**：用于结算

### 申请流程

#### 第一步：注册微信商户平台账号
1. 访问 [微信支付商户平台](https://pay.weixin.qq.com/)
2. 点击"成为商家"
3. 选择"普通商户"入驻

#### 第二步：提交资料
1. **主体信息**
   - 营业执照照片
   - 法人身份证正反面
   - 法人手持身份证照片

2. **经营信息**
   - 商户简称
   - 客服电话
   - 经营类目（选择"教育培训-在线教育"）

3. **结算信息**
   - 对公银行账户信息
   - 开户许可证

#### 第三步：签约产品
审核通过后，签约以下产品：
- **JSAPI支付**：用于微信内H5支付
- **Native支付**：用于PC端扫码支付
- **H5支付**：用于非微信浏览器支付

#### 第四步：获取配置参数
签约完成后，在商户平台获取：
- `AppID`：微信公众号/小程序的AppID
- `MchID`：商户号
- `APIKey`：API密钥（需自行设置）
- `APIv3Key`：APIv3密钥
- `证书文件`：apiclient_cert.pem 和 apiclient_key.pem

### 系统配置
在管理后台"支付配置"中填写：

| 配置项 | 说明 | 示例 |
|-------|------|-----|
| AppID | 微信公众号/小程序AppID | wx1234567890abcdef |
| 商户号(MchID) | 微信支付商户号 | 1234567890 |
| API密钥 | 商户平台设置的APIKey | 32位字符串 |
| APIv3密钥 | 商户平台设置的APIv3Key | 32位字符串 |
| 证书序列号 | 商户API证书序列号 | 40位十六进制 |
| 私钥内容 | apiclient_key.pem内容 | -----BEGIN PRIVATE KEY----- |
| 回调地址 | 支付结果通知URL | https://yourdomain.com/api/v1/payment/wechat/notify |

### 测试建议
1. 先在沙箱环境测试
2. 使用微信支付的测试账号
3. 确保回调地址可被外网访问

### 常见问题
- **签名错误**：检查APIKey是否正确，注意大小写
- **证书错误**：确保证书文件完整上传
- **回调失败**：检查服务器是否能被微信服务器访问

---

## 支付宝支付

### 申请条件
1. **企业资质**：需要营业执照
2. **已备案网站**：需要ICP备案号
3. **企业支付宝账户**

### 申请流程

#### 第一步：注册企业支付宝
1. 访问 [支付宝开放平台](https://open.alipay.com/)
2. 使用企业支付宝账号登录
3. 完成企业实名认证

#### 第二步：创建应用
1. 进入"开发者中心"
2. 创建"网页/移动应用"
3. 填写应用信息：
   - 应用名称
   - 应用图标
   - 应用简介

#### 第三步：添加能力
为应用添加以下能力：
- **电脑网站支付**
- **手机网站支付**
- **APP支付**（如有APP）

#### 第四步：配置密钥
1. 下载 [支付宝密钥生成工具](https://opendocs.alipay.com/common/02kipk)
2. 生成RSA2密钥对
3. 上传应用公钥到开放平台
4. 保存好应用私钥

#### 第五步：提交审核
1. 填写网站/APP信息
2. 上传网站截图
3. 等待审核（1-3个工作日）

### 系统配置
在管理后台"支付配置"中填写：

| 配置项 | 说明 | 示例 |
|-------|------|-----|
| AppID | 开放平台应用ID | 2021001234567890 |
| 应用私钥 | RSA2私钥 | MIIEvgIBADANBg... |
| 支付宝公钥 | 开放平台获取 | MIIBIjANBgkqh... |
| 签名类型 | 固定RSA2 | RSA2 |
| 网关地址 | 生产/沙箱 | https://openapi.alipay.com/gateway.do |
| 回调地址 | 支付结果通知URL | https://yourdomain.com/api/v1/payment/alipay/notify |
| 返回地址 | 支付完成跳转URL | https://yourdomain.com/payment/result |

### 沙箱环境
1. 访问 [沙箱环境](https://opendocs.alipay.com/common/02kkv7)
2. 获取沙箱AppID和密钥
3. 使用沙箱版支付宝APP测试

### 常见问题
- **签名验证失败**：检查私钥格式，确保是PKCS8格式
- **应用未上线**：需要先提交审核并通过
- **权限不足**：检查是否添加了对应的能力

---

## PayPal

### 申请条件
1. **个人或企业**：均可申请
2. **有效邮箱**：用于注册账号
3. **银行卡/信用卡**：用于身份验证

### 申请流程

#### 第一步：注册PayPal商家账户
1. 访问 [PayPal Developer](https://developer.paypal.com/)
2. 点击"Sign Up"注册
3. 选择"Business Account"

#### 第二步：创建应用
1. 登录 Developer Dashboard
2. 点击 "My Apps & Credentials"
3. 点击 "Create App"
4. 填写应用名称

#### 第三步：获取凭证
创建应用后获取：
- **Client ID**：客户端ID
- **Client Secret**：客户端密钥

#### 第四步：配置Webhook
1. 在应用设置中添加Webhook
2. 选择要接收的事件：
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`

### 系统配置
在管理后台"支付配置"中填写：

| 配置项 | 说明 | 示例 |
|-------|------|-----|
| Client ID | 应用客户端ID | AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4-8aqX3... |
| Client Secret | 应用客户端密钥 | EL1tVxAjhT7cJimnz5-Nsx9k2reTKSVfErNQF-CmrwJgxRtyl... |
| 环境 | sandbox/live | sandbox |
| Webhook ID | Webhook标识符 | 5GP028458R3080215 |
| 回调地址 | Webhook URL | https://yourdomain.com/api/v1/payment/paypal/webhook |

### 沙箱测试
1. 创建沙箱测试账号
2. 使用沙箱凭证测试
3. 用沙箱买家账号完成支付

### 货币支持
PayPal支持多种货币，常用：
- USD（美元）
- EUR（欧元）
- GBP（英镑）
- CNY（人民币，需要特殊申请）

### 常见问题
- **无法收款到国内**：需要绑定国内银行卡，有提现手续费
- **汇率问题**：PayPal有货币转换费用
- **账户受限**：保持良好交易记录，避免高风险交易

---

## Stripe

### 申请条件
1. **个人或企业**：均可申请
2. **支持的国家/地区**：中国大陆暂不直接支持，需通过香港等地区注册
3. **有效证件**：身份证/护照

### 申请流程

#### 第一步：注册Stripe账号
1. 访问 [Stripe](https://stripe.com/)
2. 点击"Start now"
3. 填写邮箱和密码

#### 第二步：激活账号
1. 填写业务信息
2. 提供身份验证
3. 绑定银行账户

#### 第三步：获取API密钥
在Dashboard中获取：
- **Publishable Key**：可公开的密钥（前端使用）
- **Secret Key**：私密密钥（后端使用）

#### 第四步：配置Webhook
1. 在Dashboard中点击"Developers" > "Webhooks"
2. 添加端点URL
3. 选择要监听的事件：
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 系统配置
在管理后台"支付配置"中填写：

| 配置项 | 说明 | 示例 |
|-------|------|-----|
| Publishable Key | 可公开密钥 | pk_test_51H... |
| Secret Key | 私密密钥 | sk_test_51H... |
| Webhook Secret | Webhook签名密钥 | whsec_... |
| 环境 | test/live | test |
| 回调地址 | Webhook URL | https://yourdomain.com/api/v1/payment/stripe/webhook |

### 测试模式
1. 使用 `pk_test_` 和 `sk_test_` 开头的测试密钥
2. 使用测试卡号：
   - 成功：4242 4242 4242 4242
   - 失败：4000 0000 0000 0002
3. 任意有效期和CVV

### 货币支持
Stripe支持135+货币，常用：
- USD、EUR、GBP、JPY、CAD、AUD等

### 注意事项
- **中国大陆限制**：Stripe不直接服务中国大陆商户
- **解决方案**：
  1. 通过香港公司注册
  2. 使用Stripe Atlas创建美国公司
  3. 使用第三方聚合平台

---

## 推荐方案

### 面向国内用户
**推荐：微信支付 + 支付宝**

优势：
- 覆盖95%以上国内用户
- 手续费低（0.6%）
- 用户信任度高

劣势：
- 需要企业资质
- 申请流程较长

### 面向国际用户
**推荐：Stripe + PayPal**

优势：
- 个人可申请
- 支持多币种
- 集成简单

劣势：
- 手续费较高（约3%）
- 中国大陆商户使用受限

### 个人开发者/测试阶段
**推荐：PayPal（沙箱） + 系统测试模式**

1. 使用PayPal沙箱进行支付流程测试
2. 开启系统"测试模式"跳过真实支付
3. 正式上线前再接入国内支付

### 快速上线方案
**推荐：第三方聚合支付**

如：
- 易支付
- 虎皮椒
- 个人收款码方案

优势：
- 个人即可使用
- 接入简单

劣势：
- 手续费高（2-5%）
- 稳定性一般
- 合规风险

---

## 附录：回调地址汇总

| 支付方式 | 回调地址 |
|---------|---------|
| 微信支付 | `https://yourdomain.com/api/v1/payment/wechat/notify` |
| 支付宝 | `https://yourdomain.com/api/v1/payment/alipay/notify` |
| PayPal | `https://yourdomain.com/api/v1/payment/paypal/webhook` |
| Stripe | `https://yourdomain.com/api/v1/payment/stripe/webhook` |

> **注意**：所有回调地址必须使用HTTPS，且能被外网访问。

---

## 联系支持

如果在接入过程中遇到问题，可以：
1. 查阅各支付平台官方文档
2. 联系系统管理员
3. 查看系统日志排查问题

**官方文档链接**：
- [微信支付文档](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [支付宝文档](https://opendocs.alipay.com/open/270/105899)
- [PayPal文档](https://developer.paypal.com/docs/)
- [Stripe文档](https://stripe.com/docs)
