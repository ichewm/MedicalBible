/**
 * @file 认证流程 E2E 测试
 * @description 测试登录、注册、退出等认证相关流程
 */
import { test, expect } from '@playwright/test'
import { TEST_USERS, loginWithPassword, logout, clearAuth } from './utils/test-helpers'

test.describe('认证流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除之前的登录状态
    await page.goto('/login')
    await clearAuth(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test.describe('登录页面', () => {
    test('应该正确显示登录页面', async ({ page }) => {
      // 检查页面标题
      await expect(page.locator('h1')).toContainText('医学宝典')
      
      // 检查 Tab 切换
      await expect(page.getByRole('tab', { name: '验证码登录' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '密码登录' })).toBeVisible()
      
      // 检查登录按钮
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('应该能切换登录方式', async ({ page }) => {
      // 切换到密码登录
      await page.getByRole('tab', { name: '密码登录' }).click()
      await expect(page.locator('input[placeholder="密码"]')).toBeVisible()
      
      // 切换回验证码登录
      await page.getByRole('tab', { name: '验证码登录' }).click()
      await expect(page.locator('input[placeholder="验证码"]')).toBeVisible()
    })

    test('应该能切换账号类型（手机/邮箱）', async ({ page }) => {
      // 默认是手机号
      await expect(page.locator('input[placeholder="手机号"]')).toBeVisible()
      
      // 切换到邮箱
      await page.locator('.ant-segmented-item').filter({ hasText: '邮箱' }).click()
      await expect(page.locator('input[placeholder="邮箱"]')).toBeVisible()
      
      // 切换回手机号
      await page.locator('.ant-segmented-item').filter({ hasText: '手机号' }).click()
      await expect(page.locator('input[placeholder="手机号"]')).toBeVisible()
    })
  })

  test.describe('学生登录', () => {
    test('学生使用密码登录成功', async ({ page }) => {
      await loginWithPassword(page, TEST_USERS.student1)
      
      // 验证跳转到首页
      await expect(page).toHaveURL('/')
    })

    test('错误密码应该提示错误', async ({ page }) => {
      // 切换到密码登录
      await page.getByRole('tab', { name: '密码登录' }).click()
      
      // 切换到邮箱
      await page.locator('.ant-segmented-item').filter({ hasText: '邮箱' }).click()
      
      // 输入错误密码
      await page.fill('input[placeholder="邮箱"]', TEST_USERS.student1.email)
      await page.fill('input[placeholder="密码"]', 'wrongpassword')
      await page.click('button[type="submit"]')
      
      // 等待错误提示
      await expect(page.locator('.ant-message')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('教师登录', () => {
    test('教师登录后应该跳转到教师端', async ({ page }) => {
      await loginWithPassword(page, TEST_USERS.teacher)
      
      // 验证跳转到教师端
      await expect(page).toHaveURL('/teacher')
    })
  })

  test.describe('管理员登录', () => {
    test('管理员登录后应该跳转到管理后台', async ({ page }) => {
      await loginWithPassword(page, TEST_USERS.admin)
      
      // 验证跳转到管理后台
      await expect(page).toHaveURL('/admin')
    })
  })

  test.describe('退出登录', () => {
    test('退出登录后应该跳转到登录页', async ({ page }) => {
      // 先登录
      await loginWithPassword(page, TEST_USERS.student1)
      await expect(page).toHaveURL('/')
      
      // 退出登录
      await logout(page)
      
      // 验证跳转到登录页
      await expect(page).toHaveURL('/login')
    })
  })

  test.describe('注册流程', () => {
    test('应该能切换到注册模式', async ({ page }) => {
      // 点击注册链接
      await page.click('button:has-text("没有账号？立即注册")')
      
      // 检查注册标题
      await expect(page.locator('text=注册新账号')).toBeVisible()
      
      // 检查密码输入框
      await expect(page.locator('input[placeholder*="密码"]')).toBeVisible()
    })

    test('邀请码URL参数应该自动填充', async ({ page }) => {
      await page.goto('/login?inviteCode=TEST1234')
      await page.waitForLoadState('networkidle')
      
      // 应该自动切换到注册模式并填充邀请码
      await expect(page.locator('text=注册新账号')).toBeVisible()
      
      // 检查邀请码输入框的值
      const inviteCodeInput = page.locator('input[placeholder*="邀请码"]')
      await expect(inviteCodeInput).toHaveValue('TEST1234')
    })
  })
})
