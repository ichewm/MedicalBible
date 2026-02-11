/**
 * @file Jest 测试配置
 * @description TDD 测试框架配置文件
 */

module.exports = {
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json', 'ts'],

  // 项目根目录
  rootDir: 'src',

  // 测试文件匹配规则 (unit tests + integration tests)
  testRegex: '.*\\.(spec|integration\\.spec)\\.ts$',

  // TypeScript 转换配置
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // 覆盖率收集来源
  collectCoverageFrom: ['**/*.(t|j)s'],

  // 覆盖率报告目录
  coverageDirectory: '../coverage',

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
