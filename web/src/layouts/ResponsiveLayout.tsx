/**
 * @file 响应式布局包装器
 * @description 根据屏幕尺寸自动切换PC端和移动端布局
 */

import { Grid } from 'antd'
import MainLayout from './MainLayout'
import MobileLayout from './MobileLayout'

const { useBreakpoint } = Grid

const ResponsiveLayout = () => {
  const screens = useBreakpoint()
  
  // md 以下使用移动端布局
  const isMobile = !screens.md
  
  return isMobile ? <MobileLayout /> : <MainLayout />
}

export default ResponsiveLayout
