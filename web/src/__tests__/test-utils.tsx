import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 测试用户数据（来自 config/test-users.env）
export const TEST_USERS = {
  admin: {
    email: 'admin@medicalbible.com',
    password: 'Admin@123456',
    username: '系统管理员',
    phone: '13800000001',
  },
  teacher: {
    email: 'teacher@medicalbible.com',
    password: 'Teacher@123456',
    username: '测试教师',
    phone: '13800000002',
  },
  student1: {
    email: 'student1@medicalbible.com',
    password: 'Student@123456',
    username: '测试学生1',
    phone: '13800000003',
  },
  student2: {
    email: 'student2@medicalbible.com',
    password: 'Student@123456',
    username: '测试学生2',
    phone: '13800000004',
  },
  student3: {
    email: 'student3@medicalbible.com',
    password: 'Student@123456',
    username: '测试学生3',
    phone: '13800000005',
  },
}

// 包装所有 Providers
const AllProviders = ({ children }: { children: ReactNode }) => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>{children}</BrowserRouter>
    </ConfigProvider>
  )
}

// 自定义 render 函数
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
