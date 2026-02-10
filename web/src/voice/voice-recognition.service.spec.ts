/**
 * @file 语音识别服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VoiceRecognitionService } from './voice-recognition.service'

// Mock SpeechRecognition API
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
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

  // Helper method to simulate a result
  simulateResult(transcript: string, isFinal = true) {
    const mockEvent = {
      resultIndex: 0,
      results: [
        {
          isFinal,
          0: {
            transcript,
            confidence: 0.9,
          },
          length: 1,
        },
      ],
    }
    this.onresult?.(mockEvent)
  }

  // Helper method to simulate an error
  simulateError(error: string) {
    const mockEvent = {
      error,
      message: `Error: ${error}`,
    }
    this.onerror?.(mockEvent)
  }
}

// Mock factory function
const _createMockSpeechRecognition = () => new MockSpeechRecognition()

describe('VoiceRecognitionService', () => {
  let service: VoiceRecognitionService
  let mockRecognition: MockSpeechRecognition

  beforeEach(() => {
    // Mock window object
    if (typeof window === 'undefined') {
      global.window = {} as any
    }

    // Create mock recognition
    mockRecognition = new MockSpeechRecognition()

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
  })

  afterEach(() => {
    // Clean up service
    if (service) {
      service.destroy()
    }

    // Clean up window mocks
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
  })

  describe('构造函数', () => {
    it('应该使用默认配置创建服务', () => {
      service = new VoiceRecognitionService()
      expect(service).toBeInstanceOf(VoiceRecognitionService)
    })

    it('应该使用自定义配置创建服务', () => {
      service = new VoiceRecognitionService({
        lang: 'en-US',
        continuous: false,
        interimResults: false,
      })
      expect(service).toBeInstanceOf(VoiceRecognitionService)
    })
  })

  describe('isSupported', () => {
    it('应该在支持 SpeechRecognition 时返回 true', () => {
      expect(VoiceRecognitionService.isSupported()).toBe(true)
    })

    it('应该在不支持时返回 false', () => {
      // Save the current mock
      const originalSpeechRecognition = (window as any).SpeechRecognition
      const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition

      // Remove support
      delete (window as any).SpeechRecognition
      delete (window as any).webkitSpeechRecognition

      expect(VoiceRecognitionService.isSupported()).toBe(false)

      // Restore support
      ;(window as any).SpeechRecognition = originalSpeechRecognition
      ;(window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition
    })
  })

  describe('start/stop', () => {
    beforeEach(() => {
      service = new VoiceRecognitionService({
        continuous: false,
      })
    })

    it('应该启动识别', () => {
      service.start()
      expect(mockRecognition.startCount).toBe(1)
    })

    it('应该停止识别', async () => {
      service.start()
      await new Promise(resolve => setTimeout(resolve, 10))
      service.stop()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockRecognition.stopCount).toBe(1)
    })

    it('应该中止识别', () => {
      service.start()
      service.abort()
      expect(mockRecognition.abortCount).toBe(1)
    })

    it('应该在监听状态下调用 start 不做任何事', async () => {
      let onStartCount = 0
      service.on({ onStart: () => onStartCount++ })

      service.start()
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockRecognition.startCount).toBe(1)

      service.start()
      await new Promise(resolve => setTimeout(resolve, 10))
      // 仍然是 1，因为第二次调用被忽略
      expect(mockRecognition.startCount).toBe(1)
    })
  })

  describe('事件回调', () => {
    beforeEach(() => {
      service = new VoiceRecognitionService({
        continuous: false,
      })
    })

    it('应该调用 onStart 回调', async () => {
      let started = false
      service.on({
        onStart: () => {
          started = true
        },
      })
      service.start()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(service.getIsListening()).toBe(true)
      expect(started).toBe(true)
    })

    it('应该调用 onEnd 回调', async () => {
      let ended = false
      service.on({
        onEnd: () => {
          ended = true
        },
      })
      service.start()
      // Wait for start to complete so isListening is true
      await new Promise(resolve => setTimeout(resolve, 10))
      service.stop()

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(service.getIsListening()).toBe(false)
      expect(ended).toBe(true)
    })

    it('应该调用 onResult 回调', async () => {
      const testTranscript = '测试语音'
      let receivedTranscript = ''

      service.on({
        onResult: (transcript) => {
          receivedTranscript = transcript
        },
      })

      service.start()
      mockRecognition.simulateResult(testTranscript, true)

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedTranscript).toBe(testTranscript)
    })

    it('应该调用 onError 回调', async () => {
      const testError = 'no-speech'
      let receivedError = ''

      service.on({
        onError: (error) => {
          receivedError = error
        },
      })

      service.start()
      mockRecognition.simulateError(testError)

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedError).toContain('语音')
    })

    it('应该调用 onInterim 回调', async () => {
      const interimText = '测试'
      let receivedInterim = ''

      service.on({
        onInterim: (transcript) => {
          receivedInterim = transcript
        },
      })

      service.start()
      mockRecognition.simulateResult(interimText, false)

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedInterim).toBe(interimText)
    })
  })

  describe('连续监听模式', () => {
    it('应该在 continuous 模式下自动重启', () => {
      service = new VoiceRecognitionService({
        continuous: true,
      })

      service.start()
      expect(mockRecognition.startCount).toBe(1)

      // 模拟 end 事件
      mockRecognition.onend?.()

      // 应该自动重启
      expect(mockRecognition.startCount).toBe(2)
    })

    it('应该在调用 stop 后不自动重启', () => {
      service = new VoiceRecognitionService({
        continuous: true,
      })

      service.start()
      service.stop()

      // 模拟 end 事件
      mockRecognition.onend?.()

      // 不应该重启
      expect(mockRecognition.startCount).toBe(1)
    })
  })

  describe('removeAllCallbacks', () => {
    beforeEach(() => {
      service = new VoiceRecognitionService({
        continuous: false,
      })
    })

    it('应该移除所有回调', async () => {
      let firstCallbackCalled = false
      let secondCallbackCalled = false

      service.on({
        onStart: () => {
          firstCallbackCalled = true
        },
      })

      service.removeAllCallbacks()

      service.on({
        onStart: () => {
          secondCallbackCalled = true
        },
      })

      service.start()

      // Wait for async callbacks
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(firstCallbackCalled).toBe(false)
      expect(secondCallbackCalled).toBe(true)
    })
  })

  describe('destroy', () => {
    it('应该清理资源', () => {
      service = new VoiceRecognitionService()
      service.start()
      service.destroy()

      expect(service.getIsListening()).toBe(false)
    })

    it('应该在 destroy 后无法启动', () => {
      service = new VoiceRecognitionService()
      service.destroy()
      service.start()

      // 不会抛出错误，但也无法启动
      expect(mockRecognition.startCount).toBe(0)
    })
  })

  describe('错误处理', () => {
    beforeEach(() => {
      service = new VoiceRecognitionService({
        continuous: false,
      })
    })

    it('应该处理 no-speech 错误', async () => {
      let receivedError = ''

      service.on({
        onError: (error) => {
          receivedError = error
        },
      })

      service.start()
      mockRecognition.simulateError('no-speech')

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedError).toContain('语音')
    })

    it('应该处理 audio-capture 错误', async () => {
      let receivedError = ''

      service.on({
        onError: (error) => {
          receivedError = error
        },
      })

      service.start()
      mockRecognition.simulateError('audio-capture')

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedError).toContain('麦克风')
    })

    it('应该处理 not-allowed 错误', async () => {
      let receivedError = ''

      service.on({
        onError: (error) => {
          receivedError = error
        },
      })

      service.start()
      mockRecognition.simulateError('not-allowed')

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedError).toContain('权限')
    })

    it('应该处理 network 错误', async () => {
      let receivedError = ''

      service.on({
        onError: (error) => {
          receivedError = error
        },
      })

      service.start()
      mockRecognition.simulateError('network')

      await new Promise(resolve => setTimeout(resolve, 10))
      expect(receivedError).toContain('网络')
    })
  })
})
