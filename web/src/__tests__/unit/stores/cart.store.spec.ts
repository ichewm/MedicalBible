/**
 * @file Cart Store 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '@/stores/cart'

describe('useCartStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useCartStore.setState({
      selectedLevelId: null,
      selectedPriceId: null,
      selectedPrice: null,
      preferredPaymentMethod: null,
    })
  })

  describe('初始状态', () => {
    it('应该初始化为空状态', () => {
      const state = useCartStore.getState()

      expect(state.selectedLevelId).toBeNull()
      expect(state.selectedPriceId).toBeNull()
      expect(state.selectedPrice).toBeNull()
      expect(state.preferredPaymentMethod).toBeNull()
    })

    it('hasItems 应该返回 false', () => {
      expect(useCartStore.getState().hasItems()).toBe(false)
    })
  })

  describe('setSelectedLevel', () => {
    it('应该正确设置等级 ID', () => {
      useCartStore.getState().setSelectedLevel(1)
      const state = useCartStore.getState()

      expect(state.selectedLevelId).toBe(1)
    })

    it('应该允许清除等级 ID', () => {
      useCartStore.getState().setSelectedLevel(1)
      expect(useCartStore.getState().selectedLevelId).toBe(1)

      useCartStore.getState().setSelectedLevel(null)
      expect(useCartStore.getState().selectedLevelId).toBeNull()
    })

    it('应该可以修改等级 ID', () => {
      useCartStore.getState().setSelectedLevel(1)
      useCartStore.getState().setSelectedLevel(2)

      expect(useCartStore.getState().selectedLevelId).toBe(2)
    })
  })

  describe('setSelectedPrice', () => {
    const mockPrice = {
      id: 1,
      levelId: 1,
      name: '月卡',
      durationMonths: 1,
      price: 29.9,
      originalPrice: 39.9,
      isActive: true,
    }

    it('应该正确设置价格', () => {
      useCartStore.getState().setSelectedPrice(mockPrice)
      const state = useCartStore.getState()

      expect(state.selectedPrice).toEqual(mockPrice)
      expect(state.selectedPriceId).toBe(1)
      expect(state.selectedLevelId).toBe(1)
    })

    it('应该允许清除价格', () => {
      useCartStore.getState().setSelectedPrice(mockPrice)
      expect(useCartStore.getState().selectedPrice).toEqual(mockPrice)

      useCartStore.getState().setSelectedPrice(null)
      const state = useCartStore.getState()

      expect(state.selectedPrice).toBeNull()
      expect(state.selectedPriceId).toBeNull()
      // selectedLevelId 应该保持不变
      expect(state.selectedLevelId).toBe(1)
    })

    it('应该保留现有的 selectedLevelId', () => {
      useCartStore.getState().setSelectedLevel(2)
      useCartStore.getState().setSelectedPrice(mockPrice)

      // 价格中的 levelId 应该覆盖现有的
      expect(useCartStore.getState().selectedLevelId).toBe(1)
    })

    it('hasItems 应该在设置价格后返回 true', () => {
      expect(useCartStore.getState().hasItems()).toBe(false)

      useCartStore.getState().setSelectedPrice(mockPrice)
      expect(useCartStore.getState().hasItems()).toBe(true)
    })

    it('应该可以修改价格', () => {
      const mockPrice2 = {
        id: 2,
        levelId: 1,
        name: '季卡',
        durationMonths: 3,
        price: 79.9,
        originalPrice: 99.9,
        isActive: true,
      }

      useCartStore.getState().setSelectedPrice(mockPrice)
      useCartStore.getState().setSelectedPrice(mockPrice2)

      expect(useCartStore.getState().selectedPrice).toEqual(mockPrice2)
      expect(useCartStore.getState().selectedPriceId).toBe(2)
    })
  })

  describe('setPaymentMethod', () => {
    it('应该正确设置支付宝支付方式', () => {
      useCartStore.getState().setPaymentMethod('alipay')
      const state = useCartStore.getState()

      expect(state.preferredPaymentMethod).toBe('alipay')
    })

    it('应该正确设置微信支付方式', () => {
      useCartStore.getState().setPaymentMethod('wechat')
      const state = useCartStore.getState()

      expect(state.preferredPaymentMethod).toBe('wechat')
    })

    it('应该正确设置 PayPal 支付方式', () => {
      useCartStore.getState().setPaymentMethod('paypal')
      const state = useCartStore.getState()

      expect(state.preferredPaymentMethod).toBe('paypal')
    })

    it('应该正确设置 Stripe 支付方式', () => {
      useCartStore.getState().setPaymentMethod('stripe')
      const state = useCartStore.getState()

      expect(state.preferredPaymentMethod).toBe('stripe')
    })

    it('应该允许清除支付方式', () => {
      useCartStore.getState().setPaymentMethod('alipay')
      expect(useCartStore.getState().preferredPaymentMethod).toBe('alipay')

      useCartStore.getState().setPaymentMethod(null)
      expect(useCartStore.getState().preferredPaymentMethod).toBeNull()
    })

    it('应该可以修改支付方式', () => {
      useCartStore.getState().setPaymentMethod('alipay')
      useCartStore.getState().setPaymentMethod('wechat')

      expect(useCartStore.getState().preferredPaymentMethod).toBe('wechat')
    })
  })

  describe('clearCart', () => {
    it('应该清空购物车', () => {
      const mockPrice = {
        id: 1,
        levelId: 1,
        name: '月卡',
        durationMonths: 1,
        price: 29.9,
        originalPrice: 39.9,
        isActive: true,
      }

      useCartStore.getState().setSelectedLevel(1)
      useCartStore.getState().setSelectedPrice(mockPrice)
      useCartStore.getState().setPaymentMethod('alipay')

      expect(useCartStore.getState().selectedLevelId).toBe(1)
      expect(useCartStore.getState().selectedPrice).toEqual(mockPrice)
      expect(useCartStore.getState().selectedPriceId).toBe(1)
      expect(useCartStore.getState().preferredPaymentMethod).toBe('alipay')

      useCartStore.getState().clearCart()
      const state = useCartStore.getState()

      expect(state.selectedLevelId).toBeNull()
      expect(state.selectedPriceId).toBeNull()
      expect(state.selectedPrice).toBeNull()
      // 支付方式偏好应该保留
      expect(state.preferredPaymentMethod).toBe('alipay')
    })

    it('清空后 hasItems 应该返回 false', () => {
      const mockPrice = {
        id: 1,
        levelId: 1,
        name: '月卡',
        durationMonths: 1,
        price: 29.9,
        isActive: true,
      }

      useCartStore.getState().setSelectedPrice(mockPrice)
      expect(useCartStore.getState().hasItems()).toBe(true)

      useCartStore.getState().clearCart()
      expect(useCartStore.getState().hasItems()).toBe(false)
    })
  })

  describe('完整购物流程', () => {
    it('应该支持完整的购物流程', () => {
      const mockPrice = {
        id: 5,
        levelId: 2,
        name: '年卡',
        durationMonths: 12,
        price: 199.9,
        originalPrice: 299.9,
        isActive: true,
      }

      // 1. 选择等级
      useCartStore.getState().setSelectedLevel(2)
      expect(useCartStore.getState().selectedLevelId).toBe(2)
      expect(useCartStore.getState().hasItems()).toBe(false)

      // 2. 选择价格套餐
      useCartStore.getState().setSelectedPrice(mockPrice)
      expect(useCartStore.getState().selectedPrice).toEqual(mockPrice)
      expect(useCartStore.getState().selectedPriceId).toBe(5)
      expect(useCartStore.getState().hasItems()).toBe(true)

      // 3. 选择支付方式
      useCartStore.getState().setPaymentMethod('wechat')
      expect(useCartStore.getState().preferredPaymentMethod).toBe('wechat')

      // 4. 清空购物车
      useCartStore.getState().clearCart()
      expect(useCartStore.getState().hasItems()).toBe(false)
    })
  })
})
