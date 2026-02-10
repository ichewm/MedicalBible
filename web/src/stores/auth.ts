/**
 * @file 认证状态管理
 * @description 用户登录状态、Token 管理
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  phone?: string
  email?: string
  username?: string
  avatarUrl?: string
  avatar?: string
  inviteCode: string
  balance?: number
  currentLevelId?: number
  isNewUser?: boolean
  role?: string
  status?: number // 0-禁用, 1-正常, 2-注销申请中
  closedAt?: string // 注销申请时间
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  currentLevelId: number | null
  
  // Actions
  setAuth: (token: string, refreshToken: string, user: User) => void
  setUser: (user: User) => void
  setCurrentLevel: (levelId: number) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      currentLevelId: null,

      setAuth: (token, refreshToken, user) =>
        set({
          token,
          refreshToken,
          user,
          isAuthenticated: true,
          currentLevelId: user.currentLevelId || null,
        }),

      setUser: (user) => set({ user }),

      setCurrentLevel: (levelId) => set({ currentLevelId: levelId }),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          currentLevelId: null,
        }),
    }),
    {
      name: 'medical-bible-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentLevelId: state.currentLevelId,
      }),
    }
  )
)
