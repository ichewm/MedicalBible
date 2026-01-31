/**
 * @file 教师端讲义列表
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Select, Space, Button, Tag } from 'antd'
import { HighlightOutlined, EyeOutlined } from '@ant-design/icons'
import { getCategoryTree } from '@/api/sku'
import { getTeacherLectures } from '@/api/lecture'
import { getFileUrl } from '@/utils/file'
import LecturePreview from '@/components/LecturePreview'
import { logger } from '@/utils'

const TeacherLectureList = () => {
  const navigate = useNavigate()
  const [professions, setProfessions] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [lectures, setLectures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const [selectedProfession, setSelectedProfession] = useState<number>()
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [selectedSubject, setSelectedSubject] = useState<number>()
  
  // 预览状态
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLecture, setPreviewLecture] = useState<any>(null)

  // 获取分类树
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const data: any = await getCategoryTree()
        setProfessions(data)
      } catch (error) {
        logger.error('获取分类树失败', error)
      }
    }
    fetchTree()
  }, [])

  // 联动等级
  useEffect(() => {
    if (selectedProfession) {
      const prof = professions.find(p => p.id === selectedProfession)
      setLevels(prof?.levels || [])
      setSelectedLevel(undefined)
      setSelectedSubject(undefined)
      setSubjects([])
    } else {
      setLevels([])
      setSelectedLevel(undefined)
      setSelectedSubject(undefined)
      setSubjects([])
    }
  }, [selectedProfession, professions])

  // 联动科目
  useEffect(() => {
    if (selectedLevel) {
      const level = levels.find(l => l.id === selectedLevel)
      setSubjects(level?.subjects || [])
      setSelectedSubject(undefined)
    } else {
      setSubjects([])
      setSelectedSubject(undefined)
    }
  }, [selectedLevel, levels])

  // 加载讲义（支持三级筛选，不选择时显示全部）
  const fetchLectures = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (selectedSubject) {
        params.subjectId = selectedSubject
      } else if (selectedLevel) {
        params.levelId = selectedLevel
      } else if (selectedProfession) {
        params.professionId = selectedProfession
      }
      // 不传参数则获取全部
      const data: any = await getTeacherLectures(params)
      setLectures(Array.isArray(data) ? data : data.items || [])
    } catch (error) {
      logger.error('获取讲义列表失败', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProfession, selectedLevel, selectedSubject])

  useEffect(() => {
    fetchLectures()
  }, [fetchLectures])

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '大类', dataIndex: 'professionName', width: 100 },
    { title: '等级', dataIndex: 'levelName', width: 100 },
    { title: '科目', dataIndex: 'subjectName', width: 120 },
    { title: '讲义名称', dataIndex: 'title', ellipsis: true },
    { title: '页数', dataIndex: 'pageCount', width: 70 },
    { 
      title: '已标注', 
      dataIndex: 'highlightCount', 
      width: 100,
      render: (val: number, record: any) => (
        <Tag color={val > 0 ? 'green' : 'default'}>
          {val || 0} / {record.pageCount}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setPreviewLecture(record)
              setPreviewOpen(true)
            }}
          >
            预览
          </Button>
          <Button 
            size="small"
            type="primary" 
            icon={<HighlightOutlined />}
            onClick={() => navigate(`/teacher/highlights/${record.id}`)}
          >
            画重点
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Card title="讲义列表">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择大类"
          style={{ width: 150 }}
          value={selectedProfession}
          onChange={setSelectedProfession}
          allowClear
          options={professions.map(p => ({ label: p.name, value: p.id }))}
        />
        <Select
          placeholder="选择等级"
          style={{ width: 150 }}
          value={selectedLevel}
          onChange={setSelectedLevel}
          disabled={!selectedProfession}
          allowClear
          options={levels.map(l => ({ label: l.name, value: l.id }))}
        />
        <Select
          placeholder="选择科目"
          style={{ width: 150 }}
          value={selectedSubject}
          onChange={setSelectedSubject}
          disabled={!selectedLevel}
          allowClear
          options={subjects.map(s => ({ label: s.name, value: s.id }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={lectures}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无讲义' }}
      />
      
      {/* 讲义预览弹窗（含重点标注） */}
      {previewLecture && (
        <LecturePreview
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false)
            setPreviewLecture(null)
          }}
          lectureId={previewLecture.id}
          title={previewLecture.title}
          pdfUrl={getFileUrl(previewLecture.pdfUrl || previewLecture.fileUrl)}
          pageCount={previewLecture.pageCount}
        />
      )}
    </Card>
  )
}

export default TeacherLectureList
