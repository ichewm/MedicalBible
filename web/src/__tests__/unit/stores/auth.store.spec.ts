/**
 * @file Auth Store 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      currentLevelId: null,
    })
  })

  describe('初始状态', () => {
    it('初始状态应该是未登录', () => {
      const state = useAuthStore.getState()
      
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.currentLevelId).toBeNull()
    })
  })

  describe('setAuth - 设置认证信息', () => {
    it('登录成功后应该正确设置状态', () => {
      const mockUser = {
        id: 1,
        phone: '13800138000',
        username: '测试用户',
        inviteCode: 'TEST0001',
        balance: 100,
        currentLevelId: 2,
        role: 'student',
      }
      const token = 'mock-access-token'
      const refreshToken = 'mock-refresh-token'

      useAuthStore.getState().setAuth(token, refreshToken, mockUser)
      const state = useAuthStore.getState()

      expect(state.token).toBe(token)
      expect(state.refreshToken).toBe(refreshToken)
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
      expect(state.currentLevelId).toBe(2)
    })

    it('用户无 currentLevelId 时应该设为 null', () => {
      const mockUser = {
        id: 1,
        phone: '13800138000',
        inviteCode: 'TEST0001',
      }

      useAuthStore.getState().setAuth('token', 'refresh', mockUser)
      const state = useAuthStore.getState()

      expect(state.currentLevelId).toBeNull()
    })
  })

  describe('setUser - 更新用户信息', () => {
    it('应该正确更新用户信息', () => {
      const initialUser = {
        id: 1,
        phone: '13800138000',
        username: '原用户名',
        inviteCode: 'TEST0001',
      }
      useAuthStore.getState().setAuth('token', 'refresh', initialUser)

      const updatedUser = {
        ...initialUser,
        username: '新用户名',
        avatarUrl: 'https://example.com/avatar.jpg',
      }
      useAuthStore.getState().setUser(updatedUser)
      const state = useAuthStore.getState()

      expect(state.user?.username).toBe('新用户名')
      expect(state.user?.avatarUrl).toBe('https://example.com/avatar.jpg')
    })
  })

  describe('setCurrentLevel - 设置当前等级', () => {
    it('应该正确设置当前等级', () => {
      useAuthStore.getState().setCurrentLevel(3)
      const state = useAuthStore.getState()

      expect(state.currentLevelId).toBe(3)
    })
  })

  describe('logout - 退出登录', () => {
    it('退出登录后应该清空所有状态', () => {
      // 先设置登录状态
      const mockUser = {
        id: 1,
        phone: '13800138000',
        inviteCode: 'TEST0001',
        currentLevelId: 2,
      }
      useAuthStore.getState().setAuth('token', 'refresh', mockUser)
      
      // 验证已登录
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      // 退出登录
      useAuthStore.getState().logout()
      const state = useAuthStore.getState()

      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.currentLevelId).toBeNull()
    })
  })

  describe('角色判断', () => {
    it('管理员角色应该正确识别', () => {
      const adminUser = {
        id: 1,
        phone: '13800000001',
        inviteCode: 'ADMIN001',
        role: 'admin',
      }
      useAuthStore.getState().setAuth('token', 'refresh', adminUser)
      
      expect(useAuthStore.getState().user?.role).toBe('admin')
    })

    it('教师角色应该正确识别', () => {
      const teacherUser = {
        id: 2,
        phone: '13800000002',
        inviteCode: 'TEACH001',
        role: 'teacher',
      }
      useAuthStore.getState().setAuth('token', 'refresh', teacherUser)
      
      expect(useAuthStore.getState().user?.role).toBe('teacher')
    })

    it('学生角色应该正确识别', () => {
      const studentUser = {
        id: 3,
        phone: '13800000003',
        inviteCode: 'STU00001',
        role: 'student',
      }
      useAuthStore.getState().setAuth('token', 'refresh', studentUser)
      
      expect(useAuthStore.getState().user?.role).toBe('student')
    })
  })
})
