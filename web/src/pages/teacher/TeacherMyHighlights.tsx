/**
 * @file 教师端我的标注管理
 */

import { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, message, Empty } from 'antd'
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getMyHighlights, deleteMyHighlight } from '@/api/lecture'
import { logger } from '@/utils'

const TeacherMyHighlights = () => {
  const navigate = useNavigate()
  const [highlights, setHighlights] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 获取我的标注
  const fetchHighlights = async () => {
    setLoading(true)
    try {
      const data: any = await getMyHighlights()
      setHighlights(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('获取标注列表失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHighlights()
  }, [])

  // 删除标注
  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条标注吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMyHighlight(id)
          message.success('删除成功')
          fetchHighlights()
        } catch (error) {
          logger.error('删除标注失败', error)
          message.error('删除失败')
        }
      },
    })
  }

  // 跳转到编辑页面
  const handleEdit = (lectureId: number) => {
    navigate(`/teacher/highlights/${lectureId}`)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '大类', dataIndex: 'professionName', width: 100 },
    { title: '等级', dataIndex: 'levelName', width: 100 },
    { title: '科目', dataIndex: 'subjectName', width: 120 },
    { title: '讲义名称', dataIndex: 'lectureTitle', ellipsis: true },
    { 
      title: '页码', 
      dataIndex: 'pageIndex', 
      width: 70,
      render: (page: number) => `第 ${page} 页`
    },
    { 
      title: '标注数', 
      dataIndex: 'rectsCount', 
      width: 80,
      render: (count: number) => <Tag color="blue">{count} 个</Tag>
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleEdit(record.lectureId)}
          >
            编辑
          </Button>
          <Button 
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  // 按讲义分组统计
  const lectureStats = highlights.reduce((acc, h) => {
    if (!acc[h.lectureId]) {
      acc[h.lectureId] = {
        lectureTitle: h.lectureTitle,
        pageCount: 0,
        rectsCount: 0,
      }
    }
    acc[h.lectureId].pageCount++
    acc[h.lectureId].rectsCount += h.rectsCount
    return acc
  }, {} as Record<number, { lectureTitle: string; pageCount: number; rectsCount: number }>)

  return (
    <Card title="我的标注">
      {/* 统计信息 */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--fill-secondary)', borderRadius: 4 }}>
        <Space size="large">
          <span>
            <strong>共标注讲义：</strong>
            <Tag color="blue">{Object.keys(lectureStats).length} 本</Tag>
          </span>
          <span>
            <strong>共标注页面：</strong>
            <Tag color="green">{highlights.length} 页</Tag>
          </span>
          <span>
            <strong>共标注区域：</strong>
            <Tag color="orange">{highlights.reduce((sum, h) => sum + h.rectsCount, 0)} 个</Tag>
          </span>
        </Space>
      </div>

      {/* 标注列表 */}
      <Table
        columns={columns}
        dataSource={highlights}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ 
          emptyText: <Empty description="暂无标注记录，快去讲义列表画重点吧！" />
        }}
      />
    </Card>
  )
}

export default TeacherMyHighlights
