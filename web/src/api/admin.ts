import request from '@/utils/request'

// ==================== 系统配置 ====================

// 基础系统配置 (管理员专用)
// Note: auth.ts exports getSystemConfig for public config (/auth/config)
// This function is for admin config (/admin/config)
export function getAdminSystemConfig() {
  return request.get('/admin/config')
}

export function updateSystemConfig(data: {
  registrationEnabled?: boolean
  maxDevices?: number
  commissionRate?: number
  minWithdrawal?: number
  commissionLockDays?: number
  testMode?: boolean
}) {
  return request.put('/admin/config', data)
}

// 验证码配置
export function getCaptchaConfig() {
  return request.get('/admin/config/captcha')
}

export function updateCaptchaConfig(data: {
  codeSendInterval?: number
  codeErrorLimit?: number
  emailCodeTemplate?: string
}) {
  return request.put('/admin/config/captcha', data)
}

// 邮件配置
export function getEmailConfig() {
  return request.get('/admin/config/email')
}

export function updateEmailConfig(data: {
  provider?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  fromName?: string
  useSSL?: boolean
}) {
  return request.put('/admin/config/email', data)
}

// 短信配置
export function getSmsConfig() {
  return request.get('/admin/config/sms')
}

export function updateSmsConfig(data: {
  provider?: string
  // 阿里云
  aliyunAccessKeyId?: string
  aliyunAccessKeySecret?: string
  aliyunSignName?: string
  aliyunTemplateCode?: string
  // 腾讯云
  tencentSecretId?: string
  tencentSecretKey?: string
  tencentAppId?: string
  tencentSignName?: string
  tencentTemplateId?: string
  // 容联云
  ronglianAccountSid?: string
  ronglianAuthToken?: string
  ronglianAppId?: string
  ronglianTemplateId?: string
}) {
  return request.put('/admin/config/sms', data)
}

// 支付配置
export function getPaymentConfig() {
  return request.get('/admin/config/payment')
}

export function updatePaymentConfig(data: {
  // 微信支付
  wechatEnabled?: boolean
  wechatAppId?: string
  wechatMchId?: string
  wechatApiKey?: string
  wechatApiV3Key?: string
  wechatNotifyUrl?: string
  // 支付宝
  alipayEnabled?: boolean
  alipayAppId?: string
  alipayPrivateKey?: string
  alipayNotifyUrl?: string
  alipayReturnUrl?: string
  // PayPal
  paypalEnabled?: boolean
  paypalClientId?: string
  paypalClientSecret?: string
  paypalMode?: string
  // Stripe
  stripeEnabled?: boolean
  stripePublishableKey?: string
  stripeSecretKey?: string
  stripeMode?: string
}) {
  return request.put('/admin/config/payment', data)
}

// 存储配置
export function getStorageConfig() {
  return request.get('/admin/config/storage')
}

export function updateStorageConfig(data: {
  storage_provider?: string
  storage_cdn_domain?: string
  // 本地
  storage_local_path?: string
  storage_local_url?: string
  // OSS
  storage_oss_region?: string
  storage_oss_access_key_id?: string
  storage_oss_access_key_secret?: string
  storage_oss_bucket?: string
  storage_oss_endpoint?: string
  // COS
  storage_cos_region?: string
  storage_cos_secret_id?: string
  storage_cos_secret_key?: string
  storage_cos_bucket?: string
  // S3
  storage_s3_region?: string
  storage_s3_access_key_id?: string
  storage_s3_secret_access_key?: string
  storage_s3_bucket?: string
  storage_s3_endpoint?: string
  // MinIO
  storage_minio_endpoint?: string
  storage_minio_port?: string
  storage_minio_access_key?: string
  storage_minio_secret_key?: string
  storage_minio_bucket?: string
  storage_minio_use_ssl?: string
}) {
  return request.put('/admin/config/storage', data)
}

// 协议管理
export function getAgreements() {
  return request.get('/admin/agreements')
}

export function updateAgreement(type: 'termsOfService' | 'privacyPolicy', content: string) {
  return request.put(`/admin/agreements/${type}`, { content })
}

// 测试环境配置
export function getTestEnvConfig() {
  return request.get('/admin/config/test-env')
}

export function updateTestEnvConfig(data: {
  testModeEnabled?: boolean
  paymentTestMode?: boolean
}) {
  return request.put('/admin/config/test-env', data)
}

// 清空测试数据
export function clearTestData(confirmText: string) {
  return request.post('/admin/test-data/clear', { confirmText })
}

// ==================== 仪表盘 & 统计 ====================

export function getDashboardStats() {
  return request.get('/admin/dashboard')
}

export function getRevenueStats(params: { startDate?: string; endDate?: string; type?: 'day' | 'month' }) {
  return request.get('/admin/stats/revenue', { params })
}

export function getUserGrowthStats(params: { startDate?: string; endDate?: string; type?: 'day' | 'month' }) {
  return request.get('/admin/stats/users', { params })
}

// ==================== 用户管理 ====================

// 用户状态枚举: 0-禁用, 1-正常
export function getUserList(params: { page?: number; pageSize?: number; phone?: string; username?: string; status?: number }) {
  return request.get('/admin/users', { params })
}

export function getUserDetail(id: number) {
  return request.get(`/admin/users/${id}`)
}

export function updateUserStatus(id: number, status: number) {
  return request.put(`/admin/users/${id}/status`, { status })
}

// ==================== 内容管理 (SKU) ====================
// Admin operations for SKU CRUD - use sku.ts for public read operations
// Import getProfessions, getLevelsByProfession, etc. from @/api/sku for reads

export function createProfession(data: { name: string; description?: string }) {
  return request.post('/sku/professions', data)
}

export function updateProfession(id: number, data: { name?: string; description?: string }) {
  return request.put(`/sku/professions/${id}`, data)
}

export function deleteProfession(id: number) {
  return request.delete(`/sku/professions/${id}`)
}

export function createLevel(data: { professionId: number; name: string }) {
  return request.post('/sku/levels', data)
}

export function updateLevel(id: number, data: { name?: string }) {
  return request.put(`/sku/levels/${id}`, data)
}

export function deleteLevel(id: number) {
  return request.delete(`/sku/levels/${id}`)
}

export function createSubject(data: { levelId: number; name: string }) {
  return request.post('/sku/subjects', data)
}

export function updateSubject(id: number, data: { name?: string }) {
  return request.put(`/sku/subjects/${id}`, data)
}

export function deleteSubject(id: number) {
  return request.delete(`/sku/subjects/${id}`)
}

export function createSkuPrice(data: { levelId: number; durationMonths: number; price: number; originalPrice?: number }) {
  return request.post('/sku/prices', data)
}

export function updateSkuPrice(id: number, data: { name?: string; price?: number; originalPrice?: number; isActive?: boolean }) {
  return request.put(`/sku/prices/${id}`, data)
}

export function deleteSkuPrice(id: number) {
  return request.delete(`/sku/prices/${id}`)
}

// ==================== 试卷管理 ====================

export function getAdminPapers(params: { subjectId?: number; page?: number; pageSize?: number }) {
  return request.get('/question/admin/papers', { params })
}

export function createPaper(data: { subjectId: number; name: string; type: string; year?: number }) {
  return request.post('/question/admin/papers', data)
}

export function updatePaper(id: number, data: { name?: string; type?: string; year?: number }) {
  return request.put(`/question/admin/papers/${id}`, data)
}

export function deletePaper(id: number) {
  return request.delete(`/question/admin/papers/${id}`)
}

export function getAdminQuestions(params: { paperId: number; page?: number; pageSize?: number }) {
  return request.get('/question/admin/questions', { params })
}

export function createQuestion(data: { paperId: number; content: string; options: string[]; answer: string; analysis?: string }) {
  return request.post('/question/admin/questions', data)
}

export function updateQuestion(id: number, data: { content?: string; options?: string[]; answer?: string; analysis?: string }) {
  return request.put(`/question/admin/questions/${id}`, data)
}

export function deleteQuestion(id: number) {
  return request.delete(`/question/admin/questions/${id}`)
}

export function importQuestions(paperId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/question/admin/papers/${paperId}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// JSON格式批量导入题目
export function importQuestionsJson(paperId: number, questions: any[]) {
  return request.post(`/question/papers/${paperId}/import-json`, { questions })
}

// ==================== 财务管理 ====================

// 提现状态枚举: 0=待审核, 1=审核通过, 2=打款中, 3=已完成, 4=已拒绝
export function getAdminWithdrawals(params: { page?: number; pageSize?: number; status?: number; userId?: number }) {
  return request.get('/affiliate/admin/withdrawals', { params })
}

// approved: true=通过, false=拒绝
export function auditWithdrawal(id: number, data: { approved: boolean; rejectReason?: string }) {
  return request.put(`/affiliate/admin/withdrawals/${id}`, data)
}

export function getAdminOrders(params: { page?: number; pageSize?: number; status?: string; orderNo?: string; startDate?: string; endDate?: string }) {
  return request.get('/order/admin/all', { params })
}
