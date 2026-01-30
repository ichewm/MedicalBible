/**
 * @file E2E 测试配置
 * @description 端到端测试框架配置
 */

module.exports = {
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json', 'ts'],

  // 项目根目录
  rootDir: '.',

  // 测试文件匹配规则（e2e 测试）
  testRegex: '.e2e-spec.ts$',

  // TypeScript 转换配置
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // 测试环境
  testEnvironment: 'node',

  // 模块路径别名映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },

  // 测试超时时间
  testTimeout: 60000,

  // 详细输出
  verbose: true,
};
