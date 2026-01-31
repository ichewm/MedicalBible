/**
 * @file 讲义列表页面
 */

import { useEffect, useState } from 'react'
import { Card, List, Empty, Select, Grid } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { getLectures, type Lecture } from '@/api/lecture'
import { getCategoryTree } from '@/api/sku'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils'

// PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const { useBreakpoint } = Grid

// 讲义封面组件
const LectureCover = ({ pdfUrl }: { pdfUrl?: string }) => {
  const [hasError, setHasError] = useState(false)
  
  if (!pdfUrl || hasError) {
    return (
      <div style={{ 
        height: 150, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#fff',
        fontSize: 14
      }}>
        📖 讲义
      </div>
    )
  }
  
  return (
    <div style={{ height: 150, overflow: 'hidden', background: 'var(--fill-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Document
        file={pdfUrl}
        onLoadError={() => setHasError(true)}
        loading={
          <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            加载中...
          </div>
        }
      >
        <Page 
          pageNumber={1} 
          width={180}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  )
}

const LectureList = () => {
  const navigate = useNavigate()
  const { currentLevelId } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number>()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(false)

  // 获取科目列表 (基于当前等级)
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentLevelId) {
        setSubjects([])
        return
      }
      
      try {
        const tree = await getCategoryTree()
        let foundSubjects: any[] = []
        
        for (const prof of tree) {
          for (const level of prof.levels || []) {
            if (level.id === currentLevelId) {
              foundSubjects = (level.subjects || []).map((s: any) => ({
                ...s,
                subjectId: s.id,
                subjectName: s.name,
              }))
              break
            }
          }
          if (foundSubjects.length > 0) break
        }
        
        setSubjects(foundSubjects)
        if (foundSubjects.length > 0) {
          setSelectedSubject(foundSubjects[0].subjectId)
        }
      } catch (error) {
        logger.error('获取科目列表失败', error)
      }
    }
    fetchSubjects()
  }, [currentLevelId])

  // 获取讲义列表
  useEffect(() => {
    if (selectedSubject) {
      const fetchLectures = async () => {
        setLoading(true)
        try {
          const res: any = await getLectures(selectedSubject)
          setLectures(Array.isArray(res) ? res : res.items || [])
        } catch (error) {
          logger.error('获取讲义列表失败', error)
        } finally {
          setLoading(false)
        }
      }
      fetchLectures()
    }
  }, [selectedSubject])

  return (
    <div>
      <Card 
        title="讲义列表" 
        extra={
          currentLevelId && subjects.length > 0 ? (
            <Select
              style={{ width: isMobile ? 140 : 200 }}
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={subjects.map(s => ({ label: s.subjectName, value: s.subjectId }))}
              placeholder="选择科目"
            />
          ) : null
        }
      >
        {!currentLevelId ? (
          <Empty description="请先在首页选择已订阅的职业等级" />
        ) : subjects.length === 0 ? (
          <Empty description="当前等级下暂无科目" />
        ) : (
          <>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 4 }}
              dataSource={lectures}
              loading={loading}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    hoverable
                    cover={<LectureCover pdfUrl={item.pdfUrl} />}
                    onClick={() => navigate(`/lectures/${item.id}`)}
                  >
                    <Card.Meta 
                      title={item.title} 
                      description={
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{item.pageCount} 页</span>
                          <span>{item.viewCount} 阅读</span>
                        </div>
                      } 
                    />
                  </Card>
                </List.Item>
              )}
            />
            {lectures.length === 0 && !loading && <Empty description="暂无讲义" />}
          </>
        )}
      </Card>
    </div>
  )
}

export default LectureList
