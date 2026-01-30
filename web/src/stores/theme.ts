/**
 * @file 主题状态管理
 * @description 管理应用的明暗主题切换，支持系统主题跟随
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  /** 主题模式：light-亮色 dark-暗色 system-跟随系统 */
  mode: ThemeMode
  /** 实际应用的主题（解析system后的结果） */
  resolvedTheme: 'light' | 'dark'
  /** 设置主题模式 */
  setMode: (mode: ThemeMode) => void
  /** 初始化主题（应用启动时调用） */
  initTheme: () => void
}

/**
 * 获取系统主题偏好
 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

/**
 * 应用主题到DOM
 */
const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement
  
  if (theme === 'dark') {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedTheme: 'light',
      
      setMode: (mode: ThemeMode) => {
        const resolvedTheme = mode === 'system' ? getSystemTheme() : mode
        applyTheme(resolvedTheme)
        set({ mode, resolvedTheme })
      },
      
      initTheme: () => {
        const { mode } = get()
        const resolvedTheme = mode === 'system' ? getSystemTheme() : mode
        applyTheme(resolvedTheme)
        set({ resolvedTheme })
        
        // 监听系统主题变化
        if (typeof window !== 'undefined' && window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const handleChange = (e: MediaQueryListEvent) => {
            const { mode } = get()
            if (mode === 'system') {
              const newTheme = e.matches ? 'dark' : 'light'
              applyTheme(newTheme)
              set({ resolvedTheme: newTheme })
            }
          }
          mediaQuery.addEventListener('change', handleChange)
        }
      },
    }),
    {
      name: 'medical-bible-theme',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
