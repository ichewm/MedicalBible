/**
 * @file 语音设置状态管理
 * @description 管理语音功能的全局设置
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 监听模式
 */
export type ListeningMode = 'push-to-talk' | 'continuous'

/**
 * 语音设置状态
 */
interface VoiceState {
  /** 是否启用语音功能 */
  enabled: boolean
  /** 是否启用语音反馈（文本转语音） */
  textToSpeechEnabled: boolean
  /** 监听模式 */
  listeningMode: ListeningMode
  /** 语音音量 (0-1) */
  volume: number
  /** 识别语言 */
  language: string
  /** 是否显示语音识别的中间结果 */
  showInterim: boolean
  /** 是否在识别失败时显示提示 */
  showErrorTips: boolean

  /** 切换语音功能启用状态 */
  toggleEnabled: () => void
  /** 设置语音功能启用状态 */
  setEnabled: (enabled: boolean) => void
  /** 切换语音反馈 */
  toggleTextToSpeech: () => void
  /** 设置语音反馈 */
  setTextToSpeechEnabled: (enabled: boolean) => void
  /** 设置监听模式 */
  setListeningMode: (mode: ListeningMode) => void
  /** 设置音量 */
  setVolume: (volume: number) => void
  /** 设置语言 */
  setLanguage: (language: string) => void
  /** 设置是否显示中间结果 */
  setShowInterim: (show: boolean) => void
  /** 设置是否显示错误提示 */
  setShowErrorTips: (show: boolean) => void
}

/**
 * 语音设置 Store
 */
export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: false,
      textToSpeechEnabled: false,
      listeningMode: 'push-to-talk',
      volume: 1.0,
      language: 'zh-CN',
      showInterim: true,
      showErrorTips: true,

      toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      toggleTextToSpeech: () => set((state) => ({ textToSpeechEnabled: !state.textToSpeechEnabled })),
      setTextToSpeechEnabled: (enabled) => set({ textToSpeechEnabled: enabled }),
      setListeningMode: (mode) => set({ listeningMode: mode }),
      setVolume: (volume) => set({ volume }),
      setLanguage: (language) => set({ language }),
      setShowInterim: (show) => set({ showInterim: show }),
      setShowErrorTips: (show) => set({ showErrorTips: show }),
    }),
    {
      name: 'medical-bible-voice',
      partialize: (state) => ({
        enabled: state.enabled,
        textToSpeechEnabled: state.textToSpeechEnabled,
        listeningMode: state.listeningMode,
        volume: state.volume,
        language: state.language,
        showInterim: state.showInterim,
        showErrorTips: state.showErrorTips,
      }),
    }
  )
)
