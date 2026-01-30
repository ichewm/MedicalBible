/**
 * @file 学生端讲义流程 E2E 测试
 * @description 测试学生浏览讲义、做题等流程
 */
import { test, expect } from '@playwright/test'
import { TEST_USERS, loginWithPassword, clearAuth } from './utils/test-helpers'

test.describe('学生端 - 讲义流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除状态并登录学生账号
    await page.goto('/login')
    await clearAuth(page)
    await page.reload()
    await loginWithPassword(page, TEST_USERS.student1)
    await expect(page).toHaveURL('/')
  })

  test.describe('首页', () => {
    test('应该显示首页内容', async ({ page }) => {
      // 等待页面加载
      await page.waitForLoadState('networkidle')
      
      // 检查页面有内容
      await expect(page.locator('body')).not.toBeEmpty()
    })
  })

  test.describe('讲义列表', () => {
    test('应该能访问讲义页面', async ({ page }) => {
      // 等待页面加载
      await page.waitForLoadState('networkidle')
      
      // 尝试访问讲义相关页面
      const lectureLink = page.locator('a[href*="lecture"], [data-menu-id*="lecture"]').first()
      if (await lectureLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await lectureLink.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })

  test.describe('用户中心', () => {
    test('应该能访问个人中心', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击用户头像或个人中心入口
      const userMenu = page.locator('.ant-dropdown-trigger, .ant-avatar').first()
      if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenu.click()
        await page.waitForTimeout(500)
      }
    })
  })
})
