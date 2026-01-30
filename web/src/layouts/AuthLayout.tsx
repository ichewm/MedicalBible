/**
 * @file 认证布局
 * @description 登录页面的布局
 */

import { Outlet } from 'react-router-dom'
import { useThemeStore } from '@/stores/theme'

const AuthLayout = () => {
  const { resolvedTheme } = useThemeStore()
  
  // 根据主题选择不同的渐变背景
  const backgroundGradient = resolvedTheme === 'dark'
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: backgroundGradient,
      }}
    >
      <Outlet />
    </div>
  )
}

export default AuthLayout
