import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // 禁用并行，避免登录状态冲突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // 本地重试1次
  workers: 1, // 单线程运行，避免状态冲突
  reporter: 'html',
  timeout: 60000, // 全局超时60秒
  
  use: {
    // 基础 URL - Docker 部署地址
    baseURL: process.env.TEST_BASE_URL || 'http://localhost',
    
    // 收集失败时的 trace
    trace: 'on-first-retry',
    
    // 截图
    screenshot: 'only-on-failure',
    
    // 视频
    video: 'on-first-retry',
    
    // 操作超时
    actionTimeout: 15000,
  },

  // 配置测试项目
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
