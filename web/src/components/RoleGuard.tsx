/**
 * @file 角色权限守卫
 * @description 根据用户角色控制路由访问权限
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Spin } from 'antd'
import { useEffect, useState } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
  redirectTo?: string
}

/**
 * 角色权限守卫组件
 * @param allowedRoles - 允许访问的角色列表
 * @param redirectTo - 无权限时的重定向路径，默认 '/'
 */
export const RoleGuard = ({ children, allowedRoles, redirectTo = '/' }: RoleGuardProps) => {
  const [isReady, setIsReady] = useState(false)
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    // 等待 zustand 从 localStorage 恢复状态
    const checkAuth = () => {
      const stored = localStorage.getItem('medical-bible-auth')
      if (stored) {
        try {
          const { state } = JSON.parse(stored)
          if (state?.token && !user) {
            // 如果 localStorage 有 token 但 store 还没有恢复，等待一下
            setTimeout(checkAuth, 50)
            return
          }
        } catch {
          // 忽略
        }
      }
      setIsReady(true)
    }
    checkAuth()
  }, [user])

  if (!isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const userRole = user?.role || 'user'
  
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

export default RoleGuard
