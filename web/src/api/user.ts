/**
 * @file 用户 API
 */

import request from '@/utils/request'

export interface UserProfile {
  id: number
  phone: string
  email?: string
  username?: string
  avatarUrl?: string
  inviteCode: string
  balance: number
  currentLevelId?: number
  status?: number // 0-禁用, 1-正常, 2-注销申请中
  closedAt?: string // 注销申请时间
  createdAt: string
}

export interface UpdateProfileParams {
  username?: string
  avatarUrl?: string
}

// 获取用户信息
export function getProfile(): Promise<UserProfile> {
  return request.get('/user/profile')
}

// 更新用户信息
export function updateProfile(data: UpdateProfileParams) {
  return request.put('/user/profile', data)
}

// 获取设备列表
export function getDevices(): Promise<any[]> {
  return request.get('/user/devices')
}

// 移除设备
export function removeDevice(deviceId: string) {
  return request.delete(`/user/devices/${deviceId}`)
}

// 获取订阅列表
export function getSubscriptions(): Promise<any[]> {
  return request.get('/user/subscriptions')
}

// 设置当前等级
export function setCurrentLevel(levelId: number) {
  return request.put('/user/current-level', { levelId })
}

// 获取职业等级列表
export function getProfessionLevels(): Promise<any[]> {
  return request.get('/user/profession-levels')
}

// 申请注销账号
export function closeAccount() {
  return request.post('/user/close')
}

// 取消注销申请
export function cancelCloseAccount() {
  return request.delete('/user/close')
}

// 绑定手机号
export function bindPhone(data: { phone: string; code: string }) {
  return request.post('/user/bind-phone', data)
}

// 绑定邮箱
export function bindEmail(data: { email: string; code: string }) {
  return request.post('/user/bind-email', data)
}
