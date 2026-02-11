/**
 * @file Jest 测试配置
 * @description TDD 测试框架配置文件
 */

module.exports = {
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json', 'ts'],

  // 项目根目录
  rootDir: 'src',

  // Use single worker to reduce memory usage during tests with large buffers
  maxWorkers: 1,

  // Limit workers to prevent memory buildup
  workerThreads: false,

  // Force exit after tests complete to prevent memory buildup
  forceExit: true,

  // Run each test file in isolation to prevent cross-contamination
  isolatedModules: true,

  // Clear mocks between tests to prevent memory buildup (but not modules, as it breaks jest.mock)
  resetMocks: true,
  clearMocks: true,

  // Reset modules between tests to prevent memory leaks (but can break jest.mock)
  resetModules: false,

  // 测试文件匹配规则 (unit tests + integration tests)
  testRegex: '.*\\.(spec|integration\\.spec)\\.ts$',

  // TypeScript 转换配置
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // 覆盖率收集来源 - exclude test files from collection to reduce memory
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts', '!**/*.integration.spec.ts', '!**/*.e2e-spec.ts', '!**/test/**', '!**/test-helpers/**'],

  // 覆盖率报告目录
  coverageDirectory: '../coverage',

  // Disable coverage collection by default to prevent OOM - use --coverage flag when needed
  collectCoverage: false,

  // 测试环境
  testEnvironment: 'node',

  // 模块路径别名映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@entities/(.*)$': '<rootDir>/entities/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },

  // 测试超时时间（毫秒）
  testTimeout: 30000,

  // 详细输出
  verbose: true,

  // 覆盖率阈值（基于当前实际覆盖率设定）
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 40,
      lines: 50,
      statements: 50,
    },
  },

  // 忽略的文件模式
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.module\\.ts$',
    '\\.dto\\.ts$',
    'main\\.ts$',
  ],
};
