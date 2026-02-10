import request from '@/utils/request'

export enum VerificationCodeType {
  REGISTER = 1,
  LOGIN = 2,
  CHANGE_PASSWORD = 3,
}

export interface LoginParams {
  phone?: string
  email?: string
  code: string
  deviceId: string
  deviceName?: string
  inviteCode?: string
}

export interface RegisterParams {
  phone?: string
  email?: string
  password: string
  code: string
  inviteCode?: string
}

export interface LoginByPasswordParams {
  phone?: string
  email?: string
  password: string
  deviceId: string
  deviceName?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: {
    id: number
    phone?: string
    email?: string
    username: string
    avatarUrl?: string
    inviteCode: string
    balance: number
    currentLevelId?: number
    isNewUser?: boolean
    role?: string
  }
}

export interface SendCodeParams {
  phone?: string
  email?: string
  type?: VerificationCodeType
}

export const sendVerificationCode = (
  target: string,
  type: VerificationCodeType = VerificationCodeType.LOGIN,
) => {
  // 判断是手机号还是邮箱
  const isEmail = target.includes('@')
  const params: SendCodeParams = { type }
  if (isEmail) {
    params.email = target
  } else {
    params.phone = target
  }
  return request.post('/auth/verification-code', params)
}

export const loginByPhone = (data: LoginParams) => {
  return request.post<LoginResponse>('/auth/login/phone', data)
}

export const register = (data: RegisterParams) => {
  return request.post<LoginResponse>('/auth/register', data)
}

export const loginByPassword = (data: LoginByPasswordParams) => {
  return request.post<LoginResponse>('/auth/login/password', data)
}

export const refreshToken = (refreshToken: string) => {
  return request.post('/auth/refresh-token', { refreshToken })
}

export const logout = () => {
  return request.post('/auth/logout')
}

// 修改密码
export const changePassword = (data: { oldPassword: string; newPassword: string }) => {
  return request.post('/auth/change-password', data)
}

// 通过验证码修改密码（支持手机号或邮箱）
export const resetPasswordByCode = (data: { phone?: string; email?: string; code: string; newPassword: string }) => {
  return request.post('/auth/reset-password', data)
}

// 已登录用户发送修改密码验证码（使用用户数据库中的真实手机号/邮箱）
export const sendChangePasswordCode = (method: 'phone' | 'email') => {
  return request.post('/auth/send-change-password-code', { method })
}

// 已登录用户通过验证码修改密码
export const changePasswordByCode = (data: { method: 'phone' | 'email'; code: string; newPassword: string }) => {
  return request.post('/auth/change-password-by-code', data)
}

// 获取系统配置 (注册开关等)
export const getSystemConfig = () => {
  return request.get('/auth/config')
}
