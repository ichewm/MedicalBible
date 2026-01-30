/**
 * @file 协议页面
 * @description 展示使用条款和隐私政策
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Spin, Empty, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import request from '@/utils/request'
import DOMPurify from 'dompurify'
import './Agreement.css'

const { Title } = Typography

const Agreement = () => {
  const { type } = useParams<{ type: 'terms' | 'privacy' }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const title = type === 'terms' ? '使用条款' : '隐私政策'

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true)
        const endpoint = type === 'terms' ? '/admin/public/terms' : '/admin/public/privacy'
        const data: any = await request.get(endpoint)
        setContent(data.content || '')
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [type])

  const handleBack = () => {
    // 如果有历史记录则返回，否则跳转到首页
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="agreement-page loading">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="agreement-page">
      <div className="agreement-header">
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          className="back-btn"
        >
          返回
        </Button>
        <Title level={3} className="agreement-title">{title}</Title>
      </div>

      <div className="agreement-content">
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
        ) : (
          <Empty description={`暂无${title}内容`} />
        )}
      </div>
    </div>
  )
}

export default Agreement
