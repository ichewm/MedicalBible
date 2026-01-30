/**
 * E2E 测试工具函数
 */
import { Page, expect } from '@playwright/test'

// 测试用户配置
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
}

/**
 * 使用密码登录
 */
export async function loginWithPassword(
  page: Page,
  user: { email: string; password: string }
) {
  await page.goto('/login')
  
  // 等待页面加载
  await page.waitForLoadState('networkidle')
  
  // 如果已经登录了，直接返回
  const currentUrl = page.url()
  if (!currentUrl.includes('/login')) {
    return
  }
  
  // 切换到密码登录 Tab
  await page.getByRole('tab', { name: '密码登录' }).click()
  
  // 切换到邮箱（通过 Segmented 组件）
  await page.locator('.ant-segmented-item').filter({ hasText: '邮箱' }).click()
  
  // 等待邮箱输入框出现
  await page.waitForSelector('input[placeholder="邮箱"]')
  
  // 填写表单
  await page.fill('input[placeholder="邮箱"]', user.email)
  await page.fill('input[placeholder="密码"]', user.password)
  
  // 点击登录按钮
  await page.click('button[type="submit"]')
  
  // 等待跳转完成（等待不再是登录页）
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 20000 })
}

/**
 * 退出登录
 */
export async function logout(page: Page) {
  // 点击用户头像或下拉菜单
  const dropdown = page.locator('.ant-dropdown-trigger').first()
  if (await dropdown.isVisible()) {
    await dropdown.click()
    
    // 点击退出登录
    await page.getByText('退出登录').click()
    
    // 确认退出（如果有确认弹窗）
    const confirmButton = page.getByRole('button', { name: /确定|确认/ })
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click()
    }
    
    // 等待跳转到登录页
    await page.waitForURL('/login', { timeout: 5000 })
  }
}

/**
 * 检查是否已登录
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => {
    const stored = localStorage.getItem('medical-bible-auth')
    if (stored) {
      try {
        const { state } = JSON.parse(stored)
        return state?.token
      } catch {
        return null
      }
    }
    return null
  })
  return !!token
}

/**
 * 清除登录状态
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('medical-bible-auth')
  })
}

/**
 * 等待 API 响应
 */
export async function waitForApi(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    response => {
      const url = response.url()
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern)
      }
      return urlPattern.test(url)
    },
    { timeout: 10000 }
  )
}

/**
 * 检查 Toast 消息
 */
export async function expectToast(page: Page, message: string | RegExp) {
  const toast = page.locator('.ant-message-notice-content')
  await expect(toast).toContainText(message)
}
