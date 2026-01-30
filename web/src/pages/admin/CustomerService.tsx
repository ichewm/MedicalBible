/**
 * @file 客服工作台页面
 * @description 管理后台客服消息管理
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { 
  Card, List, Avatar, Badge, Input, Button, Space, Empty, Spin, Typography, 
  Tag, Divider, message as antMessage, Tooltip
} from 'antd'
import { 
  SendOutlined, UserOutlined, CustomerServiceOutlined, 
  ReloadOutlined
} from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import request from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isToday from 'dayjs/plugin/isToday'
import isYesterday from 'dayjs/plugin/isYesterday'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.extend(isToday)
dayjs.extend(isYesterday)
dayjs.locale('zh-cn')

const { Text } = Typography
const { TextArea } = Input

interface Conversation {
  id: number
  userId: number
  username: string
  avatar?: string
  status: number
  unreadCount: number
  lastMessagePreview?: string
  lastMessageAt?: string
}

interface Message {
  id: number
  senderType: number // 1-学员, 2-管理员
  senderId: number
  senderName?: string
  contentType: number
  content: string
  createdAt: string
}

const CustomerService = () => {
  const { token } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  // 获取会话列表
  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (searchKeyword) {
        params.keyword = searchKeyword
      }
      const data: any = await request.get('/chat/admin/conversations', { params })
      setConversations(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('获取会话列表失败', error)
    } finally {
      setLoading(false)
    }
  }, [searchKeyword])

  // 获取会话详情
  const fetchConversationDetail = useCallback(async (conversationId: number) => {
    setMessagesLoading(true)
    try {
      const data: any = await request.get(`/chat/admin/conversations/${conversationId}`)
      setMessages(data.messages || [])
      scrollToBottom()
      
      // 标记已读
      await request.put(`/chat/admin/conversations/${conversationId}/read`)
      
      // 更新会话列表中的未读数
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ))
    } catch (error) {
      console.error('获取会话详情失败', error)
    } finally {
      setMessagesLoading(false)
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
      console.log('WebSocket 已连接')
    })

    socket.on('disconnect', () => {
      console.log('WebSocket 已断开')
    })

    socket.on('newMessage', (data: { userId?: number; conversationId?: number; message: Message }) => {
      // 如果是管理员自己发送的消息，忽略（因为HTTP响应已经添加了）
      if (data.message.senderType === 2) {
        return
      }
      
      // 更新会话列表
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.userId === data.userId || c.id === data.conversationId) {
            return {
              ...c,
              lastMessagePreview: data.message.content.substring(0, 50),
              lastMessageAt: data.message.createdAt,
              unreadCount: selectedConversation?.id === c.id ? 0 : c.unreadCount + 1,
            }
          }
          return c
        })
        // 按最后消息时间排序
        return updated.sort((a, b) => 
          new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
        )
      })

      // 如果是当前选中的会话，添加消息
      if (selectedConversation && 
          (data.conversationId === selectedConversation.id || data.userId === selectedConversation.userId)) {
        setMessages(prev => [...prev, data.message])
        scrollToBottom()
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [token, selectedConversation, scrollToBottom])

  // 初始化加载会话列表
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // 选择会话时加载详情
  useEffect(() => {
    if (selectedConversation) {
      fetchConversationDetail(selectedConversation.id)
    }
  }, [selectedConversation, fetchConversationDetail])

  // 发送消息
  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConversation) return

    setSending(true)
    try {
      // 通过 HTTP API 发送（更可靠）
      const response: any = await request.post('/chat/admin/message', {
        conversationId: selectedConversation.id,
        content: messageInput.trim(),
      })

      // 添加到消息列表
      setMessages(prev => [...prev, response])
      setMessageInput('')
      scrollToBottom()

      // 更新会话列表
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id 
          ? { ...c, lastMessagePreview: messageInput.trim().substring(0, 50), lastMessageAt: new Date().toISOString() }
          : c
      ))
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
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', minHeight: 500 }}>
      {/* 左侧会话列表 */}
      <Card 
        title={
          <Space>
            <CustomerServiceOutlined />
            <span>客服工作台</span>
            <Badge 
              count={conversations.reduce((sum, c) => sum + c.unreadCount, 0)} 
              style={{ marginLeft: 8 }}
            />
          </Space>
        }
        extra={
          <Tooltip title="刷新">
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchConversations}
              loading={loading}
            />
          </Tooltip>
        }
        style={{ width: 320, flexShrink: 0, marginRight: 16 }}
        bodyStyle={{ padding: 0, height: 'calc(100% - 57px)', overflow: 'auto' }}
      >
        {/* 搜索框 */}
        <div style={{ padding: '12px 12px 0' }}>
          <Input.Search
            placeholder="搜索用户名/手机号"
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onSearch={fetchConversations}
            allowClear
            enterButton
          />
        </div>
        
        <Spin spinning={loading}>
          {conversations.length === 0 ? (
            <Empty description="暂无会话" style={{ marginTop: 60 }} />
          ) : (
            <List
              dataSource={conversations}
              renderItem={item => (
                <List.Item
                  onClick={() => setSelectedConversation(item)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedConversation?.id === item.id ? '#e6f7ff' : 'transparent',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge count={item.unreadCount} size="small">
                        <Avatar src={item.avatar} icon={<UserOutlined />} />
                      </Badge>
                    }
                    title={
                      <Space>
                        <Text strong={item.unreadCount > 0}>{item.username}</Text>
                        {item.status === 1 && <Tag color="default">已关闭</Tag>}
                      </Space>
                    }
                    description={
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text 
                          type="secondary" 
                          ellipsis 
                          style={{ maxWidth: 140, fontSize: 12 }}
                        >
                          {item.lastMessagePreview || '暂无消息'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.lastMessageAt ? formatTime(item.lastMessageAt) : ''}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>

      {/* 右侧聊天区域 */}
      <Card
        title={
          selectedConversation ? (
            <Space>
              <Avatar src={selectedConversation.avatar} icon={<UserOutlined />} />
              <span>{selectedConversation.username}</span>
            </Space>
          ) : '请选择会话'
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {selectedConversation ? (
          <>
            {/* 消息列表 */}
            <div 
              ref={messageListRef}
              style={{ 
                flex: 1, 
                overflow: 'auto', 
                padding: 16,
                background: '#f5f5f5',
              }}
            >
              <Spin spinning={messagesLoading}>
                {messages.length === 0 ? (
                  <Empty description="暂无消息" />
                ) : (
                  messages.map((msg, index) => (
                    <div 
                      key={msg.id || index}
                      style={{ 
                        marginBottom: 16,
                        display: 'flex',
                        flexDirection: msg.senderType === 2 ? 'row-reverse' : 'row',
                      }}
                    >
                      <Avatar 
                        size="small"
                        icon={msg.senderType === 2 ? <CustomerServiceOutlined /> : <UserOutlined />}
                        style={{ 
                          backgroundColor: msg.senderType === 2 ? '#1890ff' : '#87d068',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ 
                        marginLeft: msg.senderType === 2 ? 0 : 8,
                        marginRight: msg.senderType === 2 ? 8 : 0,
                        maxWidth: '70%',
                      }}>
                        <div style={{ 
                          fontSize: 11, 
                          color: '#999', 
                          marginBottom: 4,
                          textAlign: msg.senderType === 2 ? 'right' : 'left',
                        }}>
                          {msg.senderName || (msg.senderType === 2 ? '客服' : '学员')}
                          <span style={{ marginLeft: 8 }}>
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                        <div style={{
                          background: msg.senderType === 2 ? '#1890ff' : '#fff',
                          color: msg.senderType === 2 ? '#fff' : '#333',
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
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#f5f5f5',
          }}>
            <Empty description="请从左侧选择一个会话" />
          </div>
        )}
      </Card>
    </div>
  )
}

export default CustomerService
