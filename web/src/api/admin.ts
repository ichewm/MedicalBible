import request from '@/utils/request'

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

export function getProfessions() {
  return request.get('/sku/professions')
}

export function createProfession(data: { name: string; description?: string; sortOrder?: number }) {
  return request.post('/sku/professions', data)
}

export function updateProfession(id: number, data: { name?: string; description?: string; sortOrder?: number }) {
  return request.put(`/sku/professions/${id}`, data)
}

export function deleteProfession(id: number) {
  return request.delete(`/sku/professions/${id}`)
}

export function createLevel(data: { professionId: number; name: string; sortOrder?: number; commissionRate?: number }) {
  return request.post('/sku/levels', data)
}

export function updateLevel(id: number, data: { name?: string; sortOrder?: number; commissionRate?: number }) {
  return request.put(`/sku/levels/${id}`, data)
}

export function deleteLevel(id: number) {
  return request.delete(`/sku/levels/${id}`)
}

export function createSubject(data: { levelId: number; name: string; sortOrder?: number }) {
  return request.post('/sku/subjects', data)
}

export function updateSubject(id: number, data: { name?: string; sortOrder?: number }) {
  return request.put(`/sku/subjects/${id}`, data)
}

export function deleteSubject(id: number) {
  return request.delete(`/sku/subjects/${id}`)
}

export function createSkuPrice(data: { levelId: number; name: string; durationMonths: number; price: number; originalPrice?: number }) {
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
export function auditWithdrawal(id: number, data: { approved: boolean; rejectReason?: string; refundAmount?: number }) {
  return request.put(`/affiliate/admin/withdrawals/${id}`, data)
}

export function getAdminOrders(params: { page?: number; pageSize?: number; status?: string; orderNo?: string; startDate?: string; endDate?: string }) {
  return request.get('/order/admin/all', { params })
}
