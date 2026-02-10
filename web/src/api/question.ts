import request from '@/utils/request'

export interface QuestionOption {
  key: string
  val: string
}

export interface Question {
  id: number
  type: number
  content: string
  options: QuestionOption[]
  sortOrder?: number
  analysis?: string
  correctOption?: string
}

export interface Paper {
  id: number
  name: string
  subjectId: number
  year?: string
  type: string
  questionCount: number
}

export interface PaperDetail extends Paper {
  subjectName?: string
  questions: Question[]
}

export interface ExamResult {
  id: number
  score: number
  totalScore: number
  correctCount: number
  wrongCount: number
  duration: number
  createdAt: string
}

// 获取试卷列表
export function getPapers(params?: { subjectId?: number; type?: string }) {
  return request.get('/question/papers', { params })
}

// 获取试卷详情
export function getPaperDetail(id: number): Promise<PaperDetail> {
  return request.get(`/question/papers/${id}`)
}

// 提交单题答案
export function submitAnswer(data: { questionId: number; answer: string; sessionId?: string }) {
  return request.post('/question/answer', data)
}

// 开始考试
export function startExam(paperId: number) {
  return request.post('/question/exams/start', { paperId })
}

// 提交考试
export function submitExam(sessionId: string, answers: Record<number, string>) {
  // 将 {questionId: answer} 对象转换为 [{questionId, answer}] 数组
  const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
    questionId: Number(questionId),
    answer
  }))
  return request.post(`/question/exams/${sessionId}/submit`, { answers: answersArray })
}

// 获取考试结果
export function getExamResult(sessionId: string) {
  return request.get(`/question/exams/${sessionId}/result`)
}

// 获取考试进度
export function getExamProgress(sessionId: string) {
  return request.get(`/question/exams/${sessionId}/progress`)
}

// 获取考试历史记录
export function getExamHistory(params?: { page?: number; pageSize?: number }) {
  return request.get('/question/exams/history', { params })
}

// 删除考试记录
export function deleteExamRecord(sessionId: string) {
  return request.delete(`/question/exams/${sessionId}`)
}

// 获取错题本
export function getWrongBook(params?: { subjectId?: number; page?: number; pageSize?: number }) {
  return request.get('/question/wrong-books', { params })
}

// 移出错题本
export function removeFromWrongBook(questionId: number) {
  return request.delete(`/question/wrong-books/${questionId}`)
}

// 生成错题试卷
export function generateWrongPaper(data: { subjectId: number; count: number }) {
  return request.post('/question/wrong-books/generate', data)
}

// 获取用户练习统计
export interface UserPracticeStats {
  totalAnswered: number
  correctCount: number
  correctRate: number
  wrongBookCount: number
  todayAnswered: number
  streakDays: number
}

export function getUserPracticeStats(): Promise<UserPracticeStats> {
  return request.get('/question/stats')
}

// ==================== 教师功能 ====================

// 教师获取试卷列表
export function getTeacherPapers(params?: { professionId?: number; levelId?: number; subjectId?: number }) {
  return request.get('/question/teacher/papers', { params })
}

// 教师获取试卷题目列表
export function getTeacherPaperQuestions(paperId: number) {
  return request.get(`/question/teacher/papers/${paperId}/questions`)
}

// 教师修改题目（解析和答案）
export function updateTeacherQuestion(id: number, data: { analysis?: string; correctOption?: string }) {
  return request.put(`/question/teacher/questions/${id}`, data)
}
