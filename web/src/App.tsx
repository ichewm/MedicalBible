import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useAuthStore } from './stores/auth'
import { RoleGuard } from './components/RoleGuard'
import { LoadingSkeleton } from './components/LoadingSkeleton'

// 布局
import ResponsiveLayout from './layouts/ResponsiveLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './layouts/AdminLayout'
import TeacherLayout from './layouts/TeacherLayout'

// 页面 - 使用 React.lazy() 进行代码分割
const Login = lazy(() => import('./pages/auth/Login'))
const Home = lazy(() => import('./pages/Home'))
const QuestionBank = lazy(() => import('./pages/question/QuestionBank'))
const QuestionDetail = lazy(() => import('./pages/question/QuestionDetail'))
const ExamResult = lazy(() => import('./pages/question/ExamResult'))
const WrongPractice = lazy(() => import('./pages/question/WrongPractice'))
const LectureList = lazy(() => import('./pages/lecture/LectureList'))
const LectureDetail = lazy(() => import('./pages/lecture/LectureDetail'))
const Profile = lazy(() => import('./pages/user/Profile'))
const Subscription = lazy(() => import('./pages/user/Subscription'))
const Affiliate = lazy(() => import('./pages/affiliate/Affiliate'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const UserList = lazy(() => import('./pages/admin/UserList'))
const SkuManagement = lazy(() => import('./pages/admin/SkuManagement'))
const Finance = lazy(() => import('./pages/admin/Finance'))
const PaperManagement = lazy(() => import('./pages/admin/PaperManagement'))
const LectureManagement = lazy(() => import('./pages/admin/LectureManagement'))
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'))
const DataAnalysis = lazy(() => import('./pages/admin/DataAnalysis'))
const TeacherLectureList = lazy(() => import('./pages/teacher/TeacherLectureList'))
const HighlightEditor = lazy(() => import('./pages/teacher/HighlightEditor'))
const TeacherQuestionList = lazy(() => import('./pages/teacher/TeacherQuestionList'))
const TeacherMyHighlights = lazy(() => import('./pages/teacher/TeacherMyHighlights'))
const CustomerService = lazy(() => import('./pages/admin/CustomerService'))
const ChatPage = lazy(() => import('./pages/chat/ChatPage'))
// Agreement 是从 index.ts 导出的命名导出，需要特殊处理
const AgreementExport = lazy(() => import('./pages/agreement').then(m => ({ default: m.Agreement })))

// 导出 Agreement 组件供向后兼容
export const Agreement = AgreementExport

// LazyRoute 包装器 - 为所有懒加载路由提供 Suspense 回退
const LazyRoute = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSkeleton type="card" />}>
    {children}
  </Suspense>
)

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
          <Route path="/login" element={<LazyRoute><Login /></LazyRoute>} />
        </Route>

        {/* 公开的协议页面 */}
        <Route path="/agreement/:type" element={<LazyRoute><Agreement /></LazyRoute>} />

        {/* 需要登录的页面 */}
        <Route element={<PrivateRoute><ResponsiveLayout /></PrivateRoute>}>
          <Route path="/" element={<LazyRoute><Home /></LazyRoute>} />
          <Route path="/questions" element={<LazyRoute><QuestionBank /></LazyRoute>} />
          <Route path="/questions/:id" element={<LazyRoute><QuestionDetail /></LazyRoute>} />
          <Route path="/questions/result/:sessionId" element={<LazyRoute><ExamResult /></LazyRoute>} />
          <Route path="/questions/wrong-practice" element={<LazyRoute><WrongPractice /></LazyRoute>} />
          <Route path="/lectures" element={<LazyRoute><LectureList /></LazyRoute>} />
          <Route path="/lectures/:id" element={<LazyRoute><LectureDetail /></LazyRoute>} />
          <Route path="/profile" element={<LazyRoute><Profile /></LazyRoute>} />
          <Route path="/subscription" element={<LazyRoute><Subscription /></LazyRoute>} />
          <Route path="/affiliate" element={<LazyRoute><Affiliate /></LazyRoute>} />
          <Route path="/chat" element={<LazyRoute><ChatPage /></LazyRoute>} />
        </Route>

        {/* 管理后台 - 仅 admin 角色 */}
        <Route path="/admin" element={
          <RoleGuard allowedRoles={['admin']}>
            <AdminLayout />
          </RoleGuard>
        }>
          <Route index element={<LazyRoute><Dashboard /></LazyRoute>} />
          <Route path="users" element={<LazyRoute><UserList /></LazyRoute>} />
          <Route path="sku" element={<LazyRoute><SkuManagement /></LazyRoute>} />
          <Route path="finance" element={<LazyRoute><Finance /></LazyRoute>} />
          <Route path="papers" element={<LazyRoute><PaperManagement /></LazyRoute>} />
          <Route path="lectures" element={<LazyRoute><LectureManagement /></LazyRoute>} />
          <Route path="highlights/:id" element={<LazyRoute><HighlightEditor /></LazyRoute>} />
          <Route path="customer-service" element={<LazyRoute><CustomerService /></LazyRoute>} />
          <Route path="settings" element={<LazyRoute><SystemSettings /></LazyRoute>} />
          <Route path="analysis" element={<LazyRoute><DataAnalysis /></LazyRoute>} />
          <Route path="profile" element={<LazyRoute><Profile /></LazyRoute>} />
        </Route>

        {/* 教师工作台 - teacher 和 admin 角色 */}
        <Route path="/teacher" element={
          <RoleGuard allowedRoles={['teacher', 'admin']}>
            <TeacherLayout />
          </RoleGuard>
        }>
          <Route index element={<LazyRoute><TeacherLectureList /></LazyRoute>} />
          <Route path="lectures" element={<LazyRoute><TeacherLectureList /></LazyRoute>} />
          <Route path="highlights/:id" element={<LazyRoute><HighlightEditor /></LazyRoute>} />
          <Route path="questions" element={<LazyRoute><TeacherQuestionList /></LazyRoute>} />
          <Route path="my-highlights" element={<LazyRoute><TeacherMyHighlights /></LazyRoute>} />
          <Route path="profile" element={<LazyRoute><Profile /></LazyRoute>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
