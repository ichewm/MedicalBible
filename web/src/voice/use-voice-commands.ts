/**
 * @file 语音命令 React Hook
 * @description 提供语音命令功能的 React Hook
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { VoiceRecognitionService, VoiceRecognitionCallbacks } from './voice-recognition.service'
import { VoiceCommand, matchCommand } from './commands'
import { createLogger } from '@/utils/logger'

/**
 * 语音命令 Hook 配置
 */
export interface UseVoiceCommandsOptions {
  /** 是否启用语音命令，默认 false */
  enabled?: boolean
  /** 可用的命令列表，默认使用所有命令 */
  commands?: VoiceCommand[]
  /** 命令识别回调 */
  onCommandMatched?: (command: VoiceCommand, transcript: string, matches: RegExpMatchArray) => void
  /** 识别结果回调（包括未匹配的） */
  onResult?: (transcript: string) => void
  /** 错误回调 */
  onError?: (error: string) => void
  /** 监听状态变化回调 */
  onListeningChange?: (isListening: boolean) => void
  /** 中间结果回调 */
  onInterim?: (transcript: string) => void
  /** 是否自动启动，默认 false */
  autoStart?: boolean
  /** 是否调试模式，打印日志 */
  debug?: boolean
}

/**
 * 语音命令 Hook 返回值
 */
export interface UseVoiceCommandsReturn {
  /** 是否正在监听 */
  isListening: boolean
  /** 最后一次识别的文本 */
  lastTranscript: string
  /** 最后一次匹配的命令 */
  lastCommand: VoiceCommand | null
  /** 当前中间结果（实时识别文本） */
  interimTranscript: string
  /** 浏览器是否支持语音识别 */
  isSupported: boolean
  /** 开始监听 */
  start: () => void
  /** 停止监听 */
  stop: () => void
  /** 切换监听状态 */
  toggle: () => void
}

/**
 * 语音命令 Hook
 *
 * @example
 * ```tsx
 * const { isListening, start, stop, toggle } = useVoiceCommands({
 *   enabled: true,
 *   commands: navigationCommands,
 *   onCommandMatched: (command, transcript) => {
 *     // Handle matched command
 *   }
 * })
 * ```
 */
export function useVoiceCommands(
  options: UseVoiceCommandsOptions = {}
): UseVoiceCommandsReturn {
  const {
    enabled = false,
    commands: _commands,
    onCommandMatched: _onCommandMatched,
    onResult: _onResult,
    onError,
    onListeningChange,
    onInterim,
    autoStart = false,
    debug = false,
  } = options

  const logger = createLogger('VoiceCommands')
  const [isListening, setIsListening] = useState(false)
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)

  const serviceRef = useRef<VoiceRecognitionService | null>(null)
  const optionsRef = useRef(options)

  // 更新 options ref
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // 初始化服务
  useEffect(() => {
    const supported = VoiceRecognitionService.isSupported()
    setIsSupported(supported)

    if (supported) {
      const service = new VoiceRecognitionService({
        lang: 'zh-CN',
        continuous: false, // 使用手动控制
        interimResults: true,
      })

      serviceRef.current = service

      if (debug) {
        logger.debug('Service initialized')
      }

      return () => {
        service.destroy()
        if (debug) {
          logger.debug('Service destroyed')
        }
      }
    }
  }, [debug])

  // 处理命令匹配
  const handleCommandMatch = useCallback(
    (transcript: string) => {
      const availableCommands = optionsRef.current.commands
      const result = matchCommand(transcript, availableCommands)

      if (result.command && result.matches) {
        if (debug) {
          logger.debug(`Command matched: ${result.command.action}`, transcript)
        }
        setLastCommand(result.command)
        optionsRef.current.onCommandMatched?.(result.command, transcript, result.matches)
      } else {
        if (debug) {
          logger.debug(`No command matched for: ${transcript}`)
        }
      }

      optionsRef.current.onResult?.(transcript)
    },
    [debug, logger]
  )

  // 设置回调
  useEffect(() => {
    const service = serviceRef.current
    if (!service) return

    const callbacks: VoiceRecognitionCallbacks = {
      onStart: () => {
        setIsListening(true)
        onListeningChange?.(true)
        if (debug) {
          logger.debug('Listening started')
        }
      },
      onEnd: () => {
        setIsListening(false)
        onListeningChange?.(false)
        setInterimTranscript('')
        if (debug) {
          logger.debug('Listening ended')
        }
      },
      onResult: (transcript) => {
        setLastTranscript(transcript)
        handleCommandMatch(transcript)
      },
      onError: (error) => {
        onError?.(error)
        if (debug) {
          logger.error('Voice recognition error', error)
        }
      },
      onInterim: (transcript) => {
        setInterimTranscript(transcript)
        onInterim?.(transcript)
      },
    }

    service.on(callbacks)

    return () => {
      service.removeAllCallbacks()
    }
  }, [handleCommandMatch, onError, onListeningChange, onInterim, debug, logger])

  // 处理启用状态变化
  useEffect(() => {
    const service = serviceRef.current
    if (!service) return

    if (enabled && autoStart) {
      service.start()
    } else if (!enabled) {
      service.stop()
    }
  }, [enabled, autoStart])

  // 启动
  const start = useCallback(() => {
    serviceRef.current?.start()
  }, [])

  // 停止
  const stop = useCallback(() => {
    serviceRef.current?.stop()
  }, [])

  // 切换
  const toggle = useCallback(() => {
    if (isListening) {
      stop()
    } else {
      start()
    }
  }, [isListening, start, stop])

  return {
    isListening,
    lastTranscript,
    lastCommand,
    interimTranscript,
    isSupported,
    start,
    stop,
    toggle,
  }
}

/**
 * 创建简单的语音命令处理器
 * 用于需要特定命令处理的场景
 */
export function useVoiceCommandHandler(
  commandMap: Record<string, (matches: RegExpMatchArray, transcript: string) => void>,
  options: Omit<UseVoiceCommandsOptions, 'onCommandMatched'> = {}
) {
  const onCommandMatched = useCallback(
    (command: VoiceCommand, transcript: string, matches: RegExpMatchArray) => {
      const handler = commandMap[command.action]
      if (handler) {
        handler(matches, transcript)
      }
    },
    [commandMap]
  )

  return useVoiceCommands({
    ...options,
    onCommandMatched,
  })
}
