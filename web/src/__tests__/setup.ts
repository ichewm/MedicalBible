import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// 每个测试后清理
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock scrollTo
window.scrollTo = vi.fn()

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = ResizeObserverMock as any

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.IntersectionObserver = IntersectionObserverMock as any

// Mock DOMMatrix for react-pdf
global.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1
    this.b = 0
    this.c = 0
    this.d = 1
    this.e = 0
    this.f = 0
  }
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  inverse() { return this }
  multiply() { return this }
  translate() { return this }
  scale() { return this }
  toString() { return 'matrix(1,0,0,1,0,0)' }
} as any

// Mock getComputedStyle for pseudo-elements support
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = vi.fn((element) => {
  return originalGetComputedStyle(element)
}) as any
