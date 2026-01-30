import request from '@/utils/request'

export interface Lecture {
  id: number
  subjectId?: number
  title: string
  cover?: string
  fileUrl: string  // 后端返回的是 fileUrl（相对路径如 /uploads/xxx.pdf）
  pageCount: number
  viewCount?: number
  lastPage?: number  // 上次阅读页码
  subjectName?: string
}

export interface Highlight {
  id: number
  pageIndex: number
  data: any
  teacherId?: number
  teacherName?: string
  createdAt: string
}

// 获取科目讲义列表
export function getLectures(subjectId: number) {
  return request.get(`/lecture/subject/${subjectId}`)
}

// 获取讲义详情
export function getLectureDetail(id: number) {
  return request.get(`/lecture/${id}`)
}

// 更新阅读进度
export function updateProgress(id: number, pageIndex: number) {
  return request.put(`/lecture/${id}/progress`, { currentPage: pageIndex })
}

// 获取阅读历史
export function getReadingHistory() {
  return request.get('/lecture/history/reading')
}

// 获取重点标注
export function getHighlights(id: number, params?: { pageIndex?: number }) {
  return request.get(`/lecture/${id}/highlights`, { params })
}

// 教师获取讲义列表（无需订阅，支持三级筛选）
export function getTeacherLectures(params?: { professionId?: number; levelId?: number; subjectId?: number }) {
  return request.get('/lecture/teacher/list', { params })
}

// 教师获取讲义详情（无需订阅）
export function getTeacherLectureDetail(id: number) {
  return request.get(`/lecture/teacher/${id}/detail`)
}

// 教师获取讲义全部重点标注（无需订阅）
export function getTeacherHighlights(id: number) {
  return request.get(`/lecture/teacher/${id}/highlights`)
}

// 创建重点标注 (Teacher/Admin)
export function createHighlight(id: number, data: { pageIndex: number; data: any }) {
  return request.post(`/lecture/${id}/highlights`, data)
}

// 更新重点标注 (Teacher/Admin)
export function updateHighlight(highlightId: number, data: { data: any }) {
  return request.put(`/lecture/highlights/${highlightId}`, data)
}

// 删除重点标注 (Teacher/Admin)
export function deleteHighlight(highlightId: number) {
  return request.delete(`/lecture/highlights/${highlightId}`)
}

// ==================== 教师标注管理 ====================

// 教师获取自己的所有标注
export function getMyHighlights() {
  return request.get('/lecture/teacher/my-highlights')
}

// 教师删除自己的标注
export function deleteMyHighlight(id: number) {
  return request.delete(`/lecture/teacher/my-highlights/${id}`)
}
