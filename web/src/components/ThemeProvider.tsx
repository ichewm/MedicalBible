/**
 * @file 主题提供者组件
 * @description 集成 Ant Design 主题和自定义 CSS 变量主题系统
 */

import { useEffect, useMemo } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useThemeStore } from '../stores/theme'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * 主题提供者组件
 * - 初始化主题系统
 * - 同步 Ant Design 主题
 * - 监听系统主题变化
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { resolvedTheme, initTheme } = useThemeStore()

  // 初始化主题
  useEffect(() => {
    initTheme()
  }, [initTheme])

  // Ant Design 主题配置
  const antdThemeConfig = useMemo(() => {
    const isDark = resolvedTheme === 'dark'
    
    return {
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        // 主色调
        colorPrimary: '#1677ff',
        // 边框圆角
        borderRadius: 6,
        // 暗色模式下的背景色
        ...(isDark && {
          colorBgContainer: '#1f1f1f',
          colorBgElevated: '#1f1f1f',
          colorBgLayout: '#141414',
          colorBorder: '#424242',
          colorBorderSecondary: '#303030',
        }),
      },
      components: {
        // Layout 组件主题
        Layout: {
          headerBg: isDark ? '#1f1f1f' : '#ffffff',
          siderBg: isDark ? '#1f1f1f' : '#ffffff',
          bodyBg: isDark ? '#141414' : '#f5f5f5',
        },
        // Menu 组件主题
        Menu: {
          itemBg: 'transparent',
          subMenuItemBg: 'transparent',
        },
        // Card 组件主题
        Card: {
          colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
        },
        // Table 组件主题
        Table: {
          headerBg: isDark ? '#2a2a2a' : '#fafafa',
          rowHoverBg: isDark ? '#2a2a2a' : '#fafafa',
        },
        // Modal 组件主题
        Modal: {
          contentBg: isDark ? '#1f1f1f' : '#ffffff',
          headerBg: isDark ? '#1f1f1f' : '#ffffff',
        },
        // Drawer 组件主题
        Drawer: {
          colorBgElevated: isDark ? '#1f1f1f' : '#ffffff',
        },
      },
    }
  }, [resolvedTheme])

  return (
    <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
      {children}
    </ConfigProvider>
  )
}
