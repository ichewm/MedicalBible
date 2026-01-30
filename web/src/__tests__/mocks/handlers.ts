/**
 * MSW (Mock Service Worker) 处理器
 * 用于模拟 API 响应
 */
import { http, HttpResponse } from 'msw'

const API_BASE = '/api'

// 模拟用户数据
const mockUsers = {
  admin: {
    id: 1,
    phone: '13800000001',
    email: 'admin@medicalbible.com',
    username: '系统管理员',
    role: 'admin',
    avatarUrl: '',
    inviteCode: 'ADMIN001',
    balance: 0,
  },
  teacher: {
    id: 2,
    phone: '13800000002',
    email: 'teacher@medicalbible.com',
    username: '测试教师',
    role: 'teacher',
    avatarUrl: '',
    inviteCode: 'TEACH001',
    balance: 0,
  },
  student: {
    id: 3,
    phone: '13800000003',
    email: 'student1@medicalbible.com',
    username: '测试学生1',
    role: 'student',
    avatarUrl: '',
    inviteCode: 'STU00001',
    balance: 100,
  },
}

// 模拟讲义数据
const mockLectures = [
  {
    id: 1,
    title: '内科学基础',
    subtitle: '心血管系统疾病',
    description: '介绍心血管系统的基本疾病诊断与治疗',
    coverUrl: '/covers/cardiology.jpg',
    categoryId: 1,
    categoryName: '内科',
    readCount: 1500,
    questionCount: 50,
    isPublished: true,
    isFree: false,
    price: 99,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: '外科学基础',
    subtitle: '普通外科',
    description: '外科手术基本技术与操作规范',
    coverUrl: '/covers/surgery.jpg',
    categoryId: 2,
    categoryName: '外科',
    readCount: 1200,
    questionCount: 40,
    isPublished: true,
    isFree: true,
    price: 0,
    createdAt: '2024-01-02T00:00:00Z',
  },
]

// 模拟题目数据
const mockQuestions = [
  {
    id: 1,
    lectureId: 1,
    type: 'single',
    content: '下列哪项是心肌梗死的典型心电图表现？',
    options: ['ST段抬高', 'T波高尖', 'QRS波增宽', 'P波消失'],
    answer: 'A',
    explanation: 'ST段抬高是急性心肌梗死的典型表现',
    difficulty: 2,
    orderIndex: 1,
  },
  {
    id: 2,
    lectureId: 1,
    type: 'multiple',
    content: '心力衰竭的常见症状包括（多选）',
    options: ['呼吸困难', '水肿', '乏力', '心悸'],
    answer: 'A,B,C,D',
    explanation: '以上都是心力衰竭的常见症状',
    difficulty: 1,
    orderIndex: 2,
  },
]

export const handlers = [
  // ========== 认证相关 ==========
  
  // 发送验证码
  http.post(`${API_BASE}/auth/verification-code`, async () => {
    return HttpResponse.json({
      success: true,
      message: '验证码已发送',
      expiresIn: 300,
    })
  }),

  // 手机号登录
  http.post(`${API_BASE}/auth/login/phone`, async ({ request }) => {
    const body = await request.json() as { phone?: string; code: string }
    
    if (body.code !== '123456') {
      return HttpResponse.json(
        { message: '验证码错误' },
        { status: 400 }
      )
    }

    const user = body.phone === '13800000001' ? mockUsers.admin 
      : body.phone === '13800000002' ? mockUsers.teacher 
      : mockUsers.student

    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 604800,
      user,
    })
  }),

  // 密码登录
  http.post(`${API_BASE}/auth/login/password`, async ({ request }) => {
    const body = await request.json() as { email?: string; password: string }
    
    let user = mockUsers.student
    let correctPassword = 'Student@123456'
    
    if (body.email === 'admin@medicalbible.com') {
      user = mockUsers.admin
      correctPassword = 'Admin@123456'
    } else if (body.email === 'teacher@medicalbible.com') {
      user = mockUsers.teacher
      correctPassword = 'Teacher@123456'
    }

    if (body.password !== correctPassword) {
      return HttpResponse.json(
        { message: '密码错误' },
        { status: 400 }
      )
    }

    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 604800,
      user,
    })
  }),

  // 登出
  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ success: true })
  }),

  // ========== 用户相关 ==========
  
  // 获取用户信息
  http.get(`${API_BASE}/user/profile`, () => {
    return HttpResponse.json(mockUsers.student)
  }),

  // ========== 讲义相关 ==========
  
  // 获取讲义列表
  http.get(`${API_BASE}/lectures`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10')

    return HttpResponse.json({
      data: mockLectures,
      total: mockLectures.length,
      page,
      pageSize,
    })
  }),

  // 获取讲义详情
  http.get(`${API_BASE}/lectures/:id`, ({ params }) => {
    const lecture = mockLectures.find(l => l.id === Number(params.id))
    if (!lecture) {
      return HttpResponse.json(
        { message: '讲义不存在' },
        { status: 404 }
      )
    }
    return HttpResponse.json(lecture)
  }),

  // ========== 题目相关 ==========
  
  // 获取讲义题目
  http.get(`${API_BASE}/lectures/:id/questions`, ({ params }) => {
    const questions = mockQuestions.filter(q => q.lectureId === Number(params.id))
    return HttpResponse.json(questions)
  }),

  // 提交答案
  http.post(`${API_BASE}/questions/:id/submit`, async ({ request }) => {
    const body = await request.json() as { answer: string }
    const isCorrect = Math.random() > 0.3 // 70% 正确率

    return HttpResponse.json({
      isCorrect,
      correctAnswer: 'A',
      explanation: '这是答案解析',
    })
  }),

  // ========== 管理员相关 ==========
  
  // 获取用户列表
  http.get(`${API_BASE}/admin/users`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10')

    return HttpResponse.json({
      data: Object.values(mockUsers),
      total: 3,
      page,
      pageSize,
    })
  }),

  // ========== 订单相关 ==========
  
  // 创建订单
  http.post(`${API_BASE}/orders`, async ({ request }) => {
    const body = await request.json() as { skuId: number }
    
    return HttpResponse.json({
      id: Date.now(),
      orderNo: `ORD${Date.now()}`,
      skuId: body.skuId,
      amount: 99,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  }),

  // 获取支付信息
  http.get(`${API_BASE}/orders/:id/pay`, () => {
    return HttpResponse.json({
      qrCodeUrl: 'https://example.com/qrcode.png',
      expireTime: Date.now() + 15 * 60 * 1000,
    })
  }),
]
