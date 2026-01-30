import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/auth'
import { RoleGuard } from './components/RoleGuard'

// 布局
import ResponsiveLayout from './layouts/ResponsiveLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './layouts/AdminLayout'
import TeacherLayout from './layouts/TeacherLayout'

// 页面
import Login from './pages/auth/Login'
import Home from './pages/Home'
import QuestionBank from './pages/question/QuestionBank'
import QuestionDetail from './pages/question/QuestionDetail'
import ExamResult from './pages/question/ExamResult'
import WrongPractice from './pages/question/WrongPractice'
import LectureList from './pages/lecture/LectureList'
import LectureDetail from './pages/lecture/LectureDetail'
import Profile from './pages/user/Profile'
import Subscription from './pages/user/Subscription'
import Affiliate from './pages/affiliate/Affiliate'
import Dashboard from './pages/admin/Dashboard'
import UserList from './pages/admin/UserList'
import SkuManagement from './pages/admin/SkuManagement'
import Finance from './pages/admin/Finance'
import PaperManagement from './pages/admin/PaperManagement'
import LectureManagement from './pages/admin/LectureManagement'
import SystemSettings from './pages/admin/SystemSettings'
import DataAnalysis from './pages/admin/DataAnalysis'
import TeacherLectureList from './pages/teacher/TeacherLectureList'
import HighlightEditor from './pages/teacher/HighlightEditor'
import TeacherQuestionList from './pages/teacher/TeacherQuestionList'
import TeacherMyHighlights from './pages/teacher/TeacherMyHighlights'
import CustomerService from './pages/admin/CustomerService'
import ChatPage from './pages/chat/ChatPage'
import { Agreement } from './pages/agreement'

// 路由守卫
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const { isAuthenticated, token } = useAuthStore()
  
  useEffect(() => {
    // 等待 zustand 从 localStorage 恢复状态
    const checkAuth = () => {
      const stored = localStorage.getItem('medical-bible-auth')
      if (stored) {
        try {
          const { state } = JSON.parse(stored)
          if (state?.token) {
            // 如果 localStorage 有 token 但 store 还没有，等待一下
            if (!token) {
              setTimeout(checkAuth, 50)
              return
            }
          }
        } catch {
          // 忽略
        }
      }
      setIsReady(true)
    }
    checkAuth()
  }, [token])
  
  if (!isReady) {
    return null // 或者显示 loading
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 认证相关页面 */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* 公开的协议页面 */}
        <Route path="/agreement/:type" element={<Agreement />} />

        {/* 需要登录的页面 */}
        <Route element={<PrivateRoute><ResponsiveLayout /></PrivateRoute>}>
          <Route path="/" element={<Home />} />
          <Route path="/questions" element={<QuestionBank />} />
          <Route path="/questions/:id" element={<QuestionDetail />} />
          <Route path="/questions/result/:sessionId" element={<ExamResult />} />
          <Route path="/questions/wrong-practice" element={<WrongPractice />} />
          <Route path="/lectures" element={<LectureList />} />
          <Route path="/lectures/:id" element={<LectureDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/chat" element={<ChatPage />} />
        </Route>

        {/* 管理后台 - 仅 admin 角色 */}
        <Route path="/admin" element={
          <RoleGuard allowedRoles={['admin']}>
            <AdminLayout />
          </RoleGuard>
        }>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UserList />} />
          <Route path="sku" element={<SkuManagement />} />
          <Route path="finance" element={<Finance />} />
          <Route path="papers" element={<PaperManagement />} />
          <Route path="lectures" element={<LectureManagement />} />
          <Route path="highlights/:id" element={<HighlightEditor />} />
          <Route path="customer-service" element={<CustomerService />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="analysis" element={<DataAnalysis />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* 教师工作台 - teacher 和 admin 角色 */}
        <Route path="/teacher" element={
          <RoleGuard allowedRoles={['teacher', 'admin']}>
            <TeacherLayout />
          </RoleGuard>
        }>
          <Route index element={<TeacherLectureList />} />
          <Route path="lectures" element={<TeacherLectureList />} />
          <Route path="highlights/:id" element={<HighlightEditor />} />
          <Route path="questions" element={<TeacherQuestionList />} />
          <Route path="my-highlights" element={<TeacherMyHighlights />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
