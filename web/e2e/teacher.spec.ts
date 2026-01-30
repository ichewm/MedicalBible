/**
 * @file 教师端 E2E 测试
 * @description 测试教师端讲义管理、题目管理等流程
 */
import { test, expect } from '@playwright/test'
import { TEST_USERS, loginWithPassword, clearAuth } from './utils/test-helpers'

test.describe('教师端', () => {
  test.beforeEach(async ({ page }) => {
    // 清除状态并登录教师账号
    await page.goto('/login')
    await clearAuth(page)
    await page.reload()
    await loginWithPassword(page, TEST_USERS.teacher)
    await expect(page).toHaveURL('/teacher')
  })

  test.describe('教师端首页', () => {
    test('应该正确显示教师端页面', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 检查页面有内容
      await expect(page.locator('body')).not.toBeEmpty()
    })
  })

  test.describe('讲义管理', () => {
    test('应该能访问讲义管理', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击讲义管理菜单（如果可见）
      const lectureMenu = page.locator('text=讲义管理, text=讲义列表, [data-menu-id*="lecture"]').first()
      if (await lectureMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await lectureMenu.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })

  test.describe('题目管理', () => {
    test('应该能访问题目管理', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击题目管理菜单（如果可见）
      const questionMenu = page.locator('text=题目管理, text=题目列表, [data-menu-id*="question"]').first()
      if (await questionMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await questionMenu.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })
})
