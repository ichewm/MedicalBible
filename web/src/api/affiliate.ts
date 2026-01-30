import request from '@/utils/request'

export interface Commission {
  id: number
  amount: number
  sourceUserId: number
  sourceOrderNo: string
  status: 'pending' | 'settled' | 'cancelled'
  createdAt: string
}

export interface Withdrawal {
  id: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  accountInfo: any
  createdAt: string
}

// 绑定邀请码
export function bindInviteCode(code: string) {
  return request.post('/affiliate/bind', { inviteCode: code })
}

// 获取佣金列表
export function getCommissions(params?: { page?: number; pageSize?: number }) {
  return request.get('/affiliate/commissions', { params })
}

// 获取佣金统计
export function getAffiliateStats() {
  return request.get('/affiliate/stats')
}

// 申请提现
export function applyWithdrawal(data: { amount: number; accountInfo: any }) {
  return request.post('/affiliate/withdrawals', data)
}

// 获取提现记录
export function getWithdrawals(params?: { page?: number; pageSize?: number }) {
  return request.get('/affiliate/withdrawals', { params })
}

// 取消提现申请
export function cancelWithdrawal(id: number) {
  return request.delete(`/affiliate/withdrawals/${id}`)
}

// 获取下线列表
export function getInvitees(params?: { page?: number; pageSize?: number }) {
  return request.get('/affiliate/invitees', { params })
}
