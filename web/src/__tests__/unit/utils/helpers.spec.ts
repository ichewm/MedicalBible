/**
 * @file 工具函数单元测试
 */
import { describe, it, expect } from 'vitest'

// 手机号脱敏函数
export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

// 邮箱脱敏函数
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 2) return email
  return local.slice(0, 2) + '****@' + domain
}

// 价格格式化
export const formatPrice = (price: number): string => {
  return `¥${price.toFixed(2)}`
}

// 手机号验证
export const isValidPhone = (phone: string): boolean => {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 邮箱验证
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// 密码强度验证（至少8位，包含大小写字母和数字）
export const isStrongPassword = (password: string): boolean => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)
}

describe('工具函数', () => {
  describe('maskPhone - 手机号脱敏', () => {
    it('应该正确脱敏手机号', () => {
      expect(maskPhone('13800138000')).toBe('138****8000')
    })

    it('空值应该返回原值', () => {
      expect(maskPhone('')).toBe('')
    })

    it('过短的号码应该返回原值', () => {
      expect(maskPhone('1380')).toBe('1380')
    })
  })

  describe('maskEmail - 邮箱脱敏', () => {
    it('应该正确脱敏邮箱', () => {
      expect(maskEmail('student1@medicalbible.com')).toBe('st****@medicalbible.com')
    })

    it('空值应该返回原值', () => {
      expect(maskEmail('')).toBe('')
    })

    it('无效邮箱应该返回原值', () => {
      expect(maskEmail('invalid')).toBe('invalid')
    })

    it('短用户名邮箱应该返回原值', () => {
      expect(maskEmail('a@b.com')).toBe('a@b.com')
    })
  })

  describe('formatPrice - 价格格式化', () => {
    it('应该正确格式化整数价格', () => {
      expect(formatPrice(99)).toBe('¥99.00')
    })

    it('应该正确格式化小数价格', () => {
      expect(formatPrice(99.9)).toBe('¥99.90')
    })

    it('应该正确格式化0元', () => {
      expect(formatPrice(0)).toBe('¥0.00')
    })
  })

  describe('isValidPhone - 手机号验证', () => {
    it('有效手机号应该返回 true', () => {
      expect(isValidPhone('13800138000')).toBe(true)
      expect(isValidPhone('15912345678')).toBe(true)
      expect(isValidPhone('18888888888')).toBe(true)
    })

    it('无效手机号应该返回 false', () => {
      expect(isValidPhone('12345678901')).toBe(false) // 以12开头
      expect(isValidPhone('1380013800')).toBe(false)  // 10位
      expect(isValidPhone('138001380001')).toBe(false) // 12位
      expect(isValidPhone('abc12345678')).toBe(false) // 包含字母
    })
  })

  describe('isValidEmail - 邮箱验证', () => {
    it('有效邮箱应该返回 true', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('student1@medicalbible.com')).toBe(true)
      expect(isValidEmail('admin@test.cn')).toBe(true)
    })

    it('无效邮箱应该返回 false', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test @example.com')).toBe(false) // 包含空格
    })
  })

  describe('isStrongPassword - 密码强度验证', () => {
    it('强密码应该返回 true', () => {
      expect(isStrongPassword('Admin@123456')).toBe(true)
      expect(isStrongPassword('Teacher@123456')).toBe(true)
      expect(isStrongPassword('Student@123456')).toBe(true)
      expect(isStrongPassword('AbCd1234')).toBe(true)
    })

    it('弱密码应该返回 false', () => {
      expect(isStrongPassword('12345678')).toBe(false)     // 无字母
      expect(isStrongPassword('abcdefgh')).toBe(false)     // 无数字无大写
      expect(isStrongPassword('ABCDEFGH')).toBe(false)     // 无数字无小写
      expect(isStrongPassword('Abc123')).toBe(false)       // 少于8位
      expect(isStrongPassword('abcd1234')).toBe(false)     // 无大写
    })
  })
})
