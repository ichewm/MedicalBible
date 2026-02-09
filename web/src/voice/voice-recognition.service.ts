/**
 * @file 语音识别服务
 * @description 基于 Web Speech API 的语音识别服务
 */

/**
 * 语音识别事件类型
 */
export type VoiceRecognitionEventType =
  | 'start'
  | 'end'
  | 'result'
  | 'error'
  | 'interim'

/**
 * 语音识别事件回调
 */
export interface VoiceRecognitionCallbacks {
  /** 开始监听 */
  onStart?: () => void
  /** 结束监听 */
  onEnd?: () => void
  /** 识别结果（最终结果） */
  onResult?: (transcript: string, isFinal: boolean) => void
  /** 识别错误 */
  onError?: (error: string) => void
  /** 中间结果（实时识别） */
  onInterim?: (transcript: string) => void
}

/**
 * 语音识别配置
 */
export interface VoiceRecognitionConfig {
  /** 语言设置，默认 'zh-CN' */
  lang?: string
  /** 是否连续监听，默认 true */
  continuous?: boolean
  /** 是否返回中间结果，默认 true */
  interimResults?: boolean
  /** 最大备选数，默认 1 */
  maxAlternatives?: number
}

/**
 * Web Speech API 的 SpeechRecognition 类型声明
 */
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}

/**
 * 语音识别服务类
 */
export class VoiceRecognitionService {
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private callbacks: VoiceRecognitionCallbacks = {}
  private config: VoiceRecognitionConfig

  constructor(config: VoiceRecognitionConfig = {}) {
    this.config = {
      lang: config.lang || 'zh-CN',
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 1,
    }

    this.init()
  }

  /**
   * 初始化语音识别
   */
  private init(): void {
    if (typeof window === 'undefined') {
      return
    }

    // 检查浏览器支持
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      this.callbacks.onError?.('您的浏览器不支持语音识别功能')
      return
    }

    try {
      this.recognition = new SpeechRecognitionAPI()
      this.setupRecognition()
    } catch (error) {
      this.callbacks.onError?.('语音识别初始化失败')
    }
  }

  /**
   * 设置识别器事件
   */
  private setupRecognition(): void {
    if (!this.recognition) return

    this.recognition.lang = this.config.lang || 'zh-CN'
    this.recognition.continuous = this.config.continuous ?? true
    this.recognition.interimResults = this.config.interimResults ?? true
    this.recognition.maxAlternatives = this.config.maxAlternatives ?? 1

    this.recognition.onstart = () => {
      this.isListening = true
      this.callbacks.onStart?.()
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.callbacks.onEnd?.()

      // 如果是连续模式且应该保持监听，自动重启
      if (this.config.continuous && this.shouldRestart) {
        try {
          this.recognition?.start()
        } catch (error) {
          this.callbacks.onError?.('语音识别重启失败')
        }
      }
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // 发送中间结果
      if (interimTranscript) {
        this.callbacks.onInterim?.(interimTranscript)
      }

      // 发送最终结果
      if (finalTranscript) {
        this.callbacks.onResult?.(finalTranscript, true)
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = '语音识别错误'

      switch (event.error) {
        case 'no-speech':
          errorMessage = '未检测到语音输入'
          break
        case 'audio-capture':
          errorMessage = '无法访问麦克风'
          break
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝'
          break
        case 'network':
          errorMessage = '网络连接错误'
          break
        case 'aborted':
          errorMessage = '语音识别已中止'
          break
        default:
          errorMessage = event.error || '未知错误'
      }

      this.callbacks.onError?.(errorMessage)
    }
  }

  private shouldRestart = false

  /**
   * 开始监听
   */
  start(): void {
    if (!this.recognition) {
      this.callbacks.onError?.('语音识别未初始化')
      return
    }

    if (this.isListening) {
      return
    }

    try {
      this.shouldRestart = this.config.continuous || false
      this.recognition.start()
    } catch (error) {
      this.callbacks.onError?.('启动语音识别失败')
    }
  }

  /**
   * 停止监听
   */
  stop(): void {
    this.shouldRestart = false
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop()
      } catch (error) {
        // 忽略停止时的错误
      }
    }
  }

  /**
   * 中止监听（立即停止）
   */
  abort(): void {
    this.shouldRestart = false
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch (error) {
        // 忽略中止时的错误
      }
    }
  }

  /**
   * 注册回调函数
   */
  on(callbacks: VoiceRecognitionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * 移除所有回调
   */
  removeAllCallbacks(): void {
    this.callbacks = {}
  }

  /**
   * 检查是否正在监听
   */
  getIsListening(): boolean {
    return this.isListening
  }

  /**
   * 检查浏览器是否支持语音识别
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    )
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stop()
    this.removeAllCallbacks()
    this.recognition = null
  }
}

/**
 * 创建语音识别服务的工厂函数
 */
export const createVoiceRecognitionService = (
  config?: VoiceRecognitionConfig
): VoiceRecognitionService => {
  return new VoiceRecognitionService(config)
}
