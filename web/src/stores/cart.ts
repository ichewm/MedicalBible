/**
 * @file 购物车状态管理
 * @description 管理订阅套餐选择和支付流程
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SkuPrice } from '@/api/sku'

type PaymentMethod = 'alipay' | 'wechat' | 'paypal' | 'stripe'

interface CartState {
  /** 选中的等级 ID */
  selectedLevelId: number | null
  /** 选中的价格 ID */
  selectedPriceId: number | null
  /** 选中的价格详情 */
  selectedPrice: SkuPrice | null
  /** 首选支付方式 */
  preferredPaymentMethod: PaymentMethod | null

  /** Actions */
  setSelectedLevel: (levelId: number | null) => void
  setSelectedPrice: (price: SkuPrice | null) => void
  setPaymentMethod: (method: PaymentMethod | null) => void
  clearCart: () => void
  hasItems: () => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      selectedLevelId: null,
      selectedPriceId: null,
      selectedPrice: null,
      preferredPaymentMethod: null,

      setSelectedLevel: (levelId: number | null) => {
        set({ selectedLevelId: levelId })
      },

      setSelectedPrice: (price: SkuPrice | null) => {
        set({
          selectedPrice: price,
          selectedPriceId: price?.id ?? null,
          selectedLevelId: price?.levelId ?? get().selectedLevelId,
        })
      },

      setPaymentMethod: (method: PaymentMethod | null) => {
        set({ preferredPaymentMethod: method })
      },

      clearCart: () => {
        set({
          selectedLevelId: null,
          selectedPriceId: null,
          selectedPrice: null,
        })
      },

      hasItems: () => {
        return get().selectedPrice !== null
      },
    }),
    {
      name: 'medical-bible-cart',
      partialize: (state) => ({
        selectedLevelId: state.selectedLevelId,
        selectedPriceId: state.selectedPriceId,
        selectedPrice: state.selectedPrice,
        preferredPaymentMethod: state.preferredPaymentMethod,
      }),
    }
  )
)
