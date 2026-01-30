import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// 创建 MSW 服务器
export const server = setupServer(...handlers)
