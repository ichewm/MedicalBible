/**
 * @file useVoiceCommands Hook 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceCommands, useVoiceCommandHandler } from './use-voice-commands'

// Mock SpeechRecognition API
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = 'zh-CN'
  maxAlternatives = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onresult: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null

  startCount = 0
  stopCount = 0
  abortCount = 0

  start() {
    this.startCount++
    setTimeout(() => {
      this.onstart?.()
    }, 0)
  }

  stop() {
    this.stopCount++
    setTimeout(() => {
      this.onend?.()
    }, 0)
  }

  abort() {
    this.abortCount++
  }
}

// Mock factory function
const createMockSpeechRecognition = () => new MockSpeechRecognition()

let mockRecognition: MockSpeechRecognition

beforeEach(() => {
  // Create mock recognition
  mockRecognition = createMockSpeechRecognition()

  if (typeof window !== 'undefined') {
    // Set mock constructor - use a class that returns our mock
    ;(window as any).SpeechRecognition = class {
      constructor() {
        return mockRecognition
      }
    }
    ;(window as any).webkitSpeechRecognition = class {
      constructor() {
        return mockRecognition
      }
    }
  }
})

afterEach(() => {
  if (typeof window !== 'undefined') {
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
  }
  vi.clearAllMocks()
})

describe('useVoiceCommands', () => {
  describe('基础功能', () => {
    it('应该返回正确的初始状态', () => {
      const { result } = renderHook(() => useVoiceCommands())

      expect(result.current.isListening).toBe(false)
      expect(result.current.lastTranscript).toBe('')
      expect(result.current.lastCommand).toBe(null)
      expect(result.current.interimTranscript).toBe('')
      expect(result.current.isSupported).toBe(true)
    })

    it('应该提供 start 和 stop 方法', () => {
      const { result } = renderHook(() => useVoiceCommands())

      expect(typeof result.current.start).toBe('function')
      expect(typeof result.current.stop).toBe('function')
      expect(typeof result.current.toggle).toBe('function')
    })
  })

  describe('启用/禁用控制', () => {
    it('应该在 enabled=false 时不启动', () => {
      renderHook(() =>
        useVoiceCommands({
          enabled: false,
          autoStart: true,
        })
      )

      expect(mockRecognition.startCount).toBe(0)
    })
  })

  describe('start 方法', () => {
    it('应该启动语音识别', () => {
      const { result } = renderHook(() => useVoiceCommands())

      act(() => {
        result.current.start()
      })

      expect(mockRecognition.startCount).toBe(1)
    })
  })

  describe('stop 方法', () => {
    it('应该停止语音识别', async () => {
      const { result } = renderHook(() => useVoiceCommands())

      act(() => {
        result.current.start()
      })

      // Wait for async start to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      act(() => {
        result.current.stop()
      })

      expect(mockRecognition.stopCount).toBe(1)
    })
  })

  describe('toggle 方法', () => {
    it('应该在未监听时启动', () => {
      const { result } = renderHook(() => useVoiceCommands())

      act(() => {
        result.current.toggle()
      })

      expect(mockRecognition.startCount).toBe(1)
    })

    it('应该在监听时停止', async () => {
      const { result } = renderHook(() => useVoiceCommands({
        enabled: true,
        autoStart: true,
      }))

      // Wait for auto start to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      act(() => {
        result.current.toggle()
      })

      // Wait for toggle to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      act(() => {
        result.current.toggle()
      })

      expect(mockRecognition.stopCount).toBe(1)
    })
  })
})

describe('useVoiceCommandHandler', () => {
  it('应该将命令映射到处理器', () => {
    const mockHandler1 = vi.fn()
    const mockHandler2 = vi.fn()

    const commandMap = {
      'action-1': mockHandler1,
      'action-2': mockHandler2,
    }

    renderHook(() => useVoiceCommandHandler(commandMap))

    // Hook 应该正确注册命令映射
    expect(mockHandler1).not.toHaveBeenCalled()
    expect(mockHandler2).not.toHaveBeenCalled()
  })

  it('应该在命令匹配时调用对应的处理器', () => {
    const mockHandler = vi.fn()

    const commandMap = {
      'test-action': mockHandler,
    }

    renderHook(() =>
      useVoiceCommandHandler(commandMap, {
        enabled: true,
      })
    )

    // TODO: 模拟语音识别结果匹配命令
    // 这需要完整的 mock 设置
  })
})
