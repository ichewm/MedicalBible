/**
 * @file LoadingSkeleton 单元测试
 * @description Tests for the LoadingSkeleton component used in Suspense fallbacks
 */
import { describe, it, expect } from 'vitest'
import { render } from '@/__tests__/test-utils'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

describe('LoadingSkeleton', () => {
  describe('不同类型的骨架屏', () => {
    it('应该渲染卡片类型的加载骨架', () => {
      render(<LoadingSkeleton type="card" count={4} />)
      // 验证有多个 Skeleton 元素
      const skeletons = document.querySelectorAll('.ant-skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('应该渲染列表类型的加载骨架', () => {
      render(<LoadingSkeleton type="list" count={6} />)
      const skeletons = document.querySelectorAll('.ant-skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('应该使用默认类型渲染', () => {
      render(<LoadingSkeleton />)
      const skeletons = document.querySelectorAll('.ant-skeleton')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('数量参数', () => {
    it('应该使用指定的数量渲染卡片', () => {
      render(<LoadingSkeleton type="card" count={3} />)
      const cards = document.querySelectorAll('.ant-card')
      expect(cards.length).toBe(3)
    })

    it('应该使用默认数量 (6)', () => {
      render(<LoadingSkeleton type="card" />)
      const cards = document.querySelectorAll('.ant-card')
      expect(cards.length).toBe(6)
    })
  })

  describe('布局验证', () => {
    it('应该在卡片类型时渲染网格布局', () => {
      render(<LoadingSkeleton type="card" count={4} />)
      const container = document.querySelector('div[style*="grid"]')
      expect(container).toBeInTheDocument()
    })
  })
})
