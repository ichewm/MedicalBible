/**
 * @file 学员客服聊天页面
 * @description 学员与客服的即时通讯页面
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { 
  Card, Input, Button, Space, Empty, Spin, Avatar, Divider, message as antMessage,
  Typography
} from 'antd'
import { 
  SendOutlined, CustomerServiceOutlined, UserOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import request from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isToday from 'dayjs/plugin/isToday'
import isYesterday from 'dayjs/plugin/isYesterday'
import 'dayjs/locale/zh-cn'
import { logger } from '@/utils'

dayjs.extend(relativeTime)
dayjs.extend(isToday)
dayjs.extend(isYesterday)
dayjs.locale('zh-cn')

const { TextArea } = Input
const { Text } = Typography

interface Message {
  id: number
  senderType: number // 1-学员, 2-管理员
  senderId: number
  senderName?: string
  contentType: number
  content: string
  createdAt: string
}

const ChatPage = () => {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  // 获取历史消息
  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await request.get('/chat/messages')
      setMessages(Array.isArray(data) ? data : [])
      scrollToBottom()
      
      // 标记已读
      await request.put('/chat/read')
    } catch (error) {
      logger.error('获取消息失败', error)
    } finally {
      setLoading(false)
    }
  }, [scrollToBottom])

  // WebSocket 连接
  useEffect(() => {
    if (!token) return

    // 使用当前域名，通过 nginx 代理 WebSocket
    const wsUrl = `${window.location.protocol}//${window.location.host}/chat`
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
    })

    socket.on('connect', () => {
      logger.log('WebSocket 已连接')
      setConnected(true)
    })

    socket.on('disconnect', () => {
      logger.log('WebSocket 已断开')
      setConnected(false)
    })

    socket.on('newMessage', (data: { message: Message }) => {
      setMessages(prev => [...prev, data.message])
      scrollToBottom()
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [token, scrollToBottom])

  // 初始化加载消息
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // 发送消息
  const handleSend = async () => {
    if (!messageInput.trim()) return

    setSending(true)
    try {
      const response: any = await request.post('/chat/message', {
        content: messageInput.trim(),
      })

      setMessages(prev => [...prev, response])
      setMessageInput('')
      scrollToBottom()
    } catch (error) {
      antMessage.error('发送失败')
    } finally {
      setSending(false)
    }
  }

  // 按回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 格式化时间
  const formatTime = (time: string) => {
    const date = dayjs(time)
    if (date.isToday()) {
      return date.format('HH:mm')
    }
    if (date.isYesterday()) {
      return '昨天 ' + date.format('HH:mm')
    }
    return date.format('MM-DD HH:mm')
  }

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '0 auto', 
      height: 'calc(100vh - 200px)', 
      minHeight: 400,
      maxHeight: 700,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Card
        title={
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate(-1)}
            />
            <CustomerServiceOutlined />
            <span>在线客服</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {connected ? '已连接' : '连接中...'}
            </Text>
          </Space>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ 
          body: {
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            padding: 0,
            overflow: 'hidden',
            minHeight: 0,
          }
        }}
      >
        {/* 消息列表 */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 16,
          background: '#f5f5f5',
          minHeight: 0,
        }}>
          <Spin spinning={loading}>
            {/* 欢迎提示 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                欢迎使用在线客服，消息保留7天
              </Text>
            </div>
            
            {messages.length === 0 && !loading ? (
              <Empty description="暂无消息，发送消息开始对话" />
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={msg.id || index}
                  style={{ 
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: msg.senderType === 1 ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar 
                    size="small"
                    icon={msg.senderType === 2 ? <CustomerServiceOutlined /> : <UserOutlined />}
                    style={{ 
                      backgroundColor: msg.senderType === 1 ? '#1890ff' : '#87d068',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ 
                    marginLeft: msg.senderType === 1 ? 0 : 8,
                    marginRight: msg.senderType === 1 ? 8 : 0,
                    maxWidth: '70%',
                  }}>
                    <div style={{ 
                      fontSize: 11, 
                      color: '#999', 
                      marginBottom: 4,
                      textAlign: msg.senderType === 1 ? 'right' : 'left',
                    }}>
                      {msg.senderType === 1 ? '我' : '客服'}
                      <span style={{ marginLeft: 8 }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <div style={{
                      background: msg.senderType === 1 ? '#1890ff' : '#fff',
                      color: msg.senderType === 1 ? '#fff' : '#333',
                      padding: '8px 12px',
                      borderRadius: 8,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}>
                      {msg.contentType === 2 ? (
                        <img 
                          src={msg.content} 
                          alt="图片" 
                          style={{ maxWidth: 200, maxHeight: 200, borderRadius: 4 }} 
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </Spin>
        </div>

        {/* 输入区域 */}
        <Divider style={{ margin: 0 }} />
        <div style={{ padding: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息，按 Enter 发送..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ resize: 'none' }}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!messageInput.trim()}
            >
              发送
            </Button>
          </Space.Compact>
        </div>
      </Card>
    </div>
  )
}

export default ChatPage
