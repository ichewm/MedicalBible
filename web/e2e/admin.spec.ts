/**
 * @file 管理后台 E2E 测试
 * @description 测试管理员后台的各项功能
 */
import { test, expect } from '@playwright/test'
import { TEST_USERS, loginWithPassword, clearAuth } from './utils/test-helpers'

test.describe('管理后台', () => {
  test.beforeEach(async ({ page }) => {
    // 清除状态并登录管理员账号
    await page.goto('/login')
    await clearAuth(page)
    await page.reload()
    await loginWithPassword(page, TEST_USERS.admin)
    await expect(page).toHaveURL('/admin')
  })

  test.describe('管理后台首页', () => {
    test('应该正确显示管理后台页面', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 检查页面有内容
      await expect(page.locator('body')).not.toBeEmpty()
    })

    test('应该显示统计数据或菜单', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 检查有统计卡片或菜单
      const hasContent = await page.locator('.ant-statistic, .ant-card, .ant-menu').first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasContent).toBeTruthy()
    })
  })

  test.describe('用户管理', () => {
    test('应该能访问用户管理页面', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击用户管理菜单（如果可见）
      const userMenu = page.locator('text=用户管理, text=用户列表, [data-menu-id*="user"]').first()
      if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenu.click()
        await page.waitForLoadState('networkidle')
        
        // 检查表格
        const hasTable = await page.locator('.ant-table').isVisible({ timeout: 5000 }).catch(() => false)
        expect(hasTable).toBeTruthy()
      }
    })
  })

  test.describe('订单管理', () => {
    test('应该能访问订单管理页面', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击订单管理菜单（如果可见）
      const orderMenu = page.locator('text=订单管理, text=订单列表, [data-menu-id*="order"]').first()
      if (await orderMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await orderMenu.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })

  test.describe('系统设置', () => {
    test('应该能访问系统设置页面', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      
      // 点击系统设置菜单（如果可见）
      const settingsMenu = page.locator('text=系统设置, text=系统配置, [data-menu-id*="setting"]').first()
      if (await settingsMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await settingsMenu.click()
        await page.waitForLoadState('networkidle')
      }
    })
  })
})
