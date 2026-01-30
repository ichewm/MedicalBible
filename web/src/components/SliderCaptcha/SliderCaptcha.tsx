/**
 * @file 滑块验证组件
 * @description 本地实现的简单滑块验证，用于防止验证码暴力破解
 * @author Medical Bible Team
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Modal, message } from 'antd'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import './SliderCaptcha.css'

interface SliderCaptchaProps {
  /** 是否显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 验证成功回调 */
  onSuccess: () => void
  /** 验证失败回调 */
  onFail?: () => void
  /** 验证标题 */
  title?: string
}

// 随机生成拼图位置
const generatePuzzlePosition = (canvasWidth: number, canvasHeight: number, puzzleSize: number) => {
  const minX = puzzleSize + 20
  const maxX = canvasWidth - puzzleSize - 20
  const minY = 20
  const maxY = canvasHeight - puzzleSize - 20
  
  return {
    x: Math.floor(Math.random() * (maxX - minX)) + minX,
    y: Math.floor(Math.random() * (maxY - minY)) + minY,
  }
}

// 背景图片列表
const backgroundImages = [
  'https://picsum.photos/320/160?random=1',
  'https://picsum.photos/320/160?random=2',
  'https://picsum.photos/320/160?random=3',
  'https://picsum.photos/320/160?random=4',
  'https://picsum.photos/320/160?random=5',
]

const SliderCaptcha: React.FC<SliderCaptchaProps> = ({
  visible,
  onClose,
  onSuccess,
  onFail,
  title = '请完成安全验证',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const puzzleCanvasRef = useRef<HTMLCanvasElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [sliderLeft, setSliderLeft] = useState(0)
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>('idle')
  
  const puzzlePosition = useRef({ x: 0, y: 0 })
  const startX = useRef(0)
  const puzzleSize = 40
  const tolerance = 5 // 允许的误差像素
  
  const canvasWidth = 320
  const canvasHeight = 160
  const sliderWidth = canvasWidth - puzzleSize
  
  // 绘制拼图
  const drawPuzzle = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, operation: 'fill' | 'clip') => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + puzzleSize / 3, y)
    ctx.arc(x + puzzleSize / 2, y, puzzleSize / 6, Math.PI, 0, false)
    ctx.lineTo(x + puzzleSize, y)
    ctx.lineTo(x + puzzleSize, y + puzzleSize / 3)
    ctx.arc(x + puzzleSize, y + puzzleSize / 2, puzzleSize / 6, -Math.PI / 2, Math.PI / 2, false)
    ctx.lineTo(x + puzzleSize, y + puzzleSize)
    ctx.lineTo(x, y + puzzleSize)
    ctx.lineTo(x, y + puzzleSize / 3 * 2)
    ctx.arc(x, y + puzzleSize / 2, puzzleSize / 6, Math.PI / 2, -Math.PI / 2, true)
    ctx.lineTo(x, y)
    ctx.closePath()
    
    if (operation === 'fill') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fill()
    } else {
      ctx.clip()
    }
  }, [puzzleSize])
  
  // 初始化画布
  const initCanvas = useCallback(() => {
    setIsLoading(true)
    setIsVerified(false)
    setSliderLeft(0)
    setStatus('idle')
    
    const canvas = canvasRef.current
    const puzzleCanvas = puzzleCanvasRef.current
    if (!canvas || !puzzleCanvas) return
    
    const ctx = canvas.getContext('2d')
    const puzzleCtx = puzzleCanvas.getContext('2d')
    if (!ctx || !puzzleCtx) return
    
    // 生成随机位置
    const pos = generatePuzzlePosition(canvasWidth, canvasHeight, puzzleSize)
    puzzlePosition.current = pos
    
    // 加载背景图片
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = backgroundImages[Math.floor(Math.random() * backgroundImages.length)]
    
    img.onload = () => {
      // 绘制背景
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
      
      // 绘制拼图缺口
      drawPuzzle(ctx, pos.x, pos.y, 'fill')
      
      // 绘制拼图块
      puzzleCanvas.width = puzzleSize + 10
      puzzleCanvas.height = canvasHeight
      puzzleCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
      
      // 提取拼图块
      puzzleCtx.globalCompositeOperation = 'destination-in'
      drawPuzzle(puzzleCtx, 0, pos.y, 'fill')
      
      setIsLoading(false)
    }
    
    img.onerror = () => {
      // 使用纯色背景作为降级方案
      ctx.fillStyle = '#e0e0e0'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      drawPuzzle(ctx, pos.x, pos.y, 'fill')
      
      puzzleCanvas.width = puzzleSize + 10
      puzzleCanvas.height = canvasHeight
      puzzleCtx.fillStyle = '#1677ff'
      drawPuzzle(puzzleCtx, 0, pos.y, 'fill')
      
      setIsLoading(false)
    }
  }, [canvasWidth, canvasHeight, puzzleSize, drawPuzzle])
  
  // 鼠标/触摸开始
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isVerified || isLoading) return
    setIsDragging(true)
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX
  }
  
  // 鼠标/触摸移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    let newLeft = sliderLeft + clientX - startX.current
    
    // 限制范围
    newLeft = Math.max(0, Math.min(newLeft, sliderWidth))
    setSliderLeft(newLeft)
    startX.current = clientX
  }, [isDragging, sliderLeft, sliderWidth])
  
  // 鼠标/触摸结束
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    
    // 验证位置
    const targetX = puzzlePosition.current.x
    const diff = Math.abs(sliderLeft - targetX)
    
    if (diff <= tolerance) {
      setIsVerified(true)
      setStatus('success')
      message.success('验证成功')
      setTimeout(() => {
        onSuccess()
      }, 500)
    } else {
      setStatus('fail')
      message.error('验证失败，请重试')
      setTimeout(() => {
        setSliderLeft(0)
        setStatus('idle')
        onFail?.()
      }, 500)
    }
  }, [isDragging, sliderLeft, tolerance, onSuccess, onFail])
  
  // 绑定全局事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      document.addEventListener('touchmove', handleDragMove)
      document.addEventListener('touchend', handleDragEnd)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('touchmove', handleDragMove)
      document.removeEventListener('touchend', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])
  
  // 打开时初始化
  useEffect(() => {
    if (visible) {
      initCanvas()
    }
  }, [visible, initCanvas])
  
  // 刷新
  const handleRefresh = () => {
    initCanvas()
  }
  
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={360}
      centered
      title={title}
      className="slider-captcha-modal"
    >
      <div className="slider-captcha">
        {/* 画布区域 */}
        <div className="captcha-canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="captcha-canvas"
          />
          <canvas
            ref={puzzleCanvasRef}
            className="puzzle-canvas"
            style={{
              left: sliderLeft,
              top: 0,
            }}
          />
          {isLoading && (
            <div className="loading-mask">
              <span>加载中...</span>
            </div>
          )}
          {/* 刷新按钮 */}
          <div className="refresh-btn" onClick={handleRefresh}>
            <ReloadOutlined />
          </div>
        </div>
        
        {/* 滑块区域 */}
        <div className={`slider-track ${status}`}>
          <div 
            className="slider-progress"
            style={{ width: sliderLeft + puzzleSize }}
          />
          <div
            ref={sliderRef}
            className={`slider-btn ${isDragging ? 'dragging' : ''} ${isVerified ? 'verified' : ''}`}
            style={{ left: sliderLeft }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            {isVerified ? <CheckCircleOutlined /> : '→'}
          </div>
          <span className="slider-tip">
            {isVerified ? '验证成功' : '向右滑动完成验证'}
          </span>
        </div>
      </div>
    </Modal>
  )
}

export default SliderCaptcha
