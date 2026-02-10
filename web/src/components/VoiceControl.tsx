/**
 * @file 语音控制组件
 * @description 浮动语音控制按钮
 */

import { useState, useEffect } from 'react'
import { FloatButton, Badge, Tooltip, message } from 'antd'
import {
  AudioOutlined,
  AudioMutedOutlined,
  CloseOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voice'
import { useVoiceCommands, VoiceRecognitionService } from '@/voice/use-voice-commands'
import { navigationCommands, controlCommands, getCommandHelp } from '@/voice/commands'
import './VoiceControl.css'

/**
 * 语音控制组件属性
 */
interface VoiceControlProps {
  /** 自定义类名 */
  className?: string
  /** 语音识别的回调函数 */
  onCommand?: (action: string, transcript: string) => void
}

/**
 * 语音控制组件
 *
 * 提供全局的语音控制浮动按钮，支持开启/关闭语音识别，
 * 并提供语音反馈功能。
 */
export const VoiceControl: React.FC<VoiceControlProps> = ({
  className,
  onCommand,
}) => {
  const { enabled, toggleEnabled, textToSpeechEnabled } = useVoiceStore()
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  // 默认使用导航命令和控制命令
  const commands = [...navigationCommands, ...controlCommands]

  const { isSupported, start, stop, toggle } = useVoiceCommands({
    enabled,
    commands,
    debug: false,
    onCommandMatched: (command, transcript) => {
      if (textToSpeechEnabled) {
        speak(`已执行：${command.description}`)
      }
      onCommand?.(command.action, transcript)
      message.success(`语音命令：${transcript}`)
    },
    onResult: (transcript) => {
      if (textToSpeechEnabled) {
        speak(transcript)
      }
    },
    onError: (error) => {
      message.error(`语音识别错误：${error}`)
      setIsListening(false)
    },
    onListeningChange: (listening) => {
      setIsListening(listening)
    },
    onInterim: (transcript) => {
      setInterimText(transcript)
    },
  })

  // 文本转语音函数
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      return
    }

    // 取消之前的语音
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    window.speechSynthesis.speak(utterance)
  }

  // 切换语音功能
  const handleToggle = () => {
    if (!isSupported) {
      message.error('您的浏览器不支持语音识别功能')
      return
    }

    // 检查麦克风权限
    if (!enabled && typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            message.error('请允许麦克风权限以使用语音识别')
            return
          }
          toggleEnabled()
          if (!enabled) {
            message.success('语音控制已开启，点击麦克风按钮开始说话')
          }
        })
        .catch(() => {
          // 如果权限查询失败，直接尝试开启
          toggleEnabled()
        })
    } else {
      toggleEnabled()
      if (!enabled) {
        message.success('语音控制已开启，点击麦克风按钮开始说话')
      }
    }
  }

  // 开始/停止监听
  const handleListenToggle = () => {
    if (isListening) {
      stop()
      setInterimText('')
    } else {
      start()
    }
  }

  // 显示帮助
  const handleShowHelp = () => {
    setShowHelp(true)
  }

  if (!isSupported) {
    return null
  }

  return (
    <>
      {/* 语音控制浮动按钮组 */}
      <FloatButton.Group
        trigger="click"
        type="primary"
        icon={enabled ? <AudioOutlined /> : <AudioMutedOutlined />}
        className={`voice-control-group ${className || ''}`}
        style={{ right: 24, bottom: 24 }}
      >
        {/* 语音功能开关 */}
        <FloatButton
          icon={enabled ? <AudioOutlined /> : <AudioMutedOutlined />}
          tooltip={enabled ? '语音控制已开启' : '开启语音控制'}
          type={enabled ? 'primary' : 'default'}
          onClick={handleToggle}
        />

        {/* 监听控制按钮 */}
        {enabled && (
          <FloatButton
            icon={isListening ? <CloseOutlined /> : <AudioOutlined />}
            tooltip={isListening ? '停止监听' : '开始说话'}
            type={isListening ? 'default' : 'primary'}
            badge={{ dot: isListening }}
            onClick={handleListenToggle}
          />
        )}

        {/* 设置帮助按钮 */}
        {enabled && (
          <FloatButton
            icon={<SettingOutlined />}
            tooltip="语音命令帮助"
            onClick={handleShowHelp}
          />
        )}
      </FloatButton.Group>

      {/* 实时识别文本显示 */}
      {enabled && isListening && interimText && (
        <div className="voice-interim-text">
          <Tooltip title="正在识别...">
            <Badge status="processing" text={interimText} />
          </Tooltip>
        </div>
      )}

      {/* 命令帮助弹窗 */}
      {showHelp && (
        <div
          className="voice-help-overlay"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="voice-help-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="voice-help-header">
              <h3>语音命令帮助</h3>
              <button
                className="voice-help-close"
                onClick={() => setShowHelp(false)}
              >
                ✕
              </button>
            </div>
            <div className="voice-help-content">
              <pre>{getCommandHelp(commands)}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default VoiceControl
